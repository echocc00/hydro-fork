import {
    Context, Logger, ProblemModel, RecordModel, Schema, Service, superagent,
} from 'hydrooj';
import { STATUS } from '@hydrooj/common';

const logger = new Logger('ai-analyzer');

interface AiAnalysisResult {
    score: number;
    feasibility: string;
    suggestions: string[];
    risks: string[];
}

interface AiAnalysisError {
    error: string;
}

const STATUS_MAP: Record<number, string> = {
    [STATUS.STATUS_WAITING]: 'Waiting',
    [STATUS.STATUS_ACCEPTED]: 'Accepted',
    [STATUS.STATUS_WRONG_ANSWER]: 'Wrong Answer',
    [STATUS.STATUS_TIME_LIMIT_EXCEEDED]: 'Time Limit Exceeded',
    [STATUS.STATUS_MEMORY_LIMIT_EXCEEDED]: 'Memory Limit Exceeded',
    [STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED]: 'Output Limit Exceeded',
    [STATUS.STATUS_RUNTIME_ERROR]: 'Runtime Error',
    [STATUS.STATUS_COMPILE_ERROR]: 'Compile Error',
    [STATUS.STATUS_SYSTEM_ERROR]: 'System Error',
    [STATUS.STATUS_CANCELED]: 'Canceled',
    [STATUS.STATUS_ETC]: 'Unknown Error',
    [STATUS.STATUS_HACK_SUCCESSFUL]: 'Hack Successful',
    [STATUS.STATUS_HACK_UNSUCCESSFUL]: 'Hack Unsuccessful',
    [STATUS.STATUS_FORMAT_ERROR]: 'Format Error',
};

const SYSTEM_PROMPT = [
    'You are a programming teaching assistant for an Online Judge system.',
    'Your task is to analyze student code submissions and provide constructive feedback.',
    'You must respond in Chinese with a valid JSON object.',
    'The JSON must have these exact fields:',
    '  "score": integer 1-10, overall code quality and feasibility rating',
    '  "feasibility": string, brief assessment of whether the code can solve the problem',
    '  "suggestions": string array, 2-4 concrete improvement suggestions',
    '  "risks": string array, 1-3 potential issues or edge cases not handled',
    'Be specific and reference the actual code when possible.',
    'If the code has a Compile Error, focus on fixing the compilation issue.',
    'Keep each suggestion under 80 characters.',
].join('\n');

class AiAnalyzerService extends Service {
    static Config = Schema.object({
        endpoint: Schema.string().default('https://api.openai.com/v1'),
        apiKey: Schema.string().default('').role('secret'),
        model: Schema.string().default('gpt-4o-mini'),
        maxConcurrency: Schema.number().default(3),
        timeout: Schema.number().default(30000),
    });

    private running = 0;
    private queue: Array<() => void> = [];

    constructor(ctx: Context, private config: ReturnType<typeof AiAnalyzerService.Config>) {
        super(ctx, 'ai-analyzer');
    }

    private async enqueue(fn: () => Promise<void>) {
        if (this.running >= this.config.maxConcurrency) {
            await new Promise<void>((resolve) => this.queue.push(resolve));
        }
        this.running++;
        try {
            await fn();
        } finally {
            this.running--;
            this.queue.shift()?.();
        }
    }

    private async analyzeCode(
        code: string, lang: string, title: string, content: string,
        status: number, score?: number,
    ): Promise<AiAnalysisResult | AiAnalysisError> {
        const statusText = STATUS_MAP[status] || `Status ${status}`;
        const scoreText = typeof score === 'number' ? `${score} 分` : 'N/A';
        const userPrompt = [
            `Title: ${title}`,
            `Description: ${content.slice(0, 1024)}`,
            `Language: ${lang}`,
            `Judge Result: ${statusText} (${scoreText})`,
            `Code:`,
            '```',
            code.slice(0, 4096),
            '```',
            'Please analyze the code and return JSON.',
        ].join('\n');

        try {
            const res = await superagent
                .post(`${this.config.endpoint}/chat/completions`)
                .set('Authorization', `Bearer ${this.config.apiKey}`)
                .set('Content-Type', 'application/json')
                .send({
                    model: this.config.model,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 2048,
                    skip_think: true,
                })
                .timeout(this.config.timeout);

            const body = res.body || res.text ? JSON.parse(res.text || res.body) : null;
            if (!body?.choices?.[0]?.message?.content) {
                throw new Error('Empty response from LLM');
            }
            let raw = body.choices[0].message.content;
            // Strip <think>...</think> tags (MiniMax M2.7 thinking mode)
            raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            let parsed: any;
            try {
                parsed = JSON.parse(raw);
            } catch {
                const start = raw.indexOf('{');
                if (start === -1) throw new Error('No JSON object found in response');
                let depth = 0;
                let end = start;
                for (let i = start; i < raw.length; i++) {
                    if (raw[i] === '{') depth++;
                    else if (raw[i] === '}') {
                        depth--;
                        if (depth === 0) { end = i + 1; break; }
                    }
                }
                parsed = JSON.parse(raw.slice(start, end));
            }
            return {
                score: Math.max(1, Math.min(10, Number(parsed.score) || 5)),
                feasibility: String(parsed.feasibility || 'Analysis unavailable'),
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 6) : [],
                risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 4) : [],
            };
        } catch (e: any) {
            if (e?.name === 'AbortError' || e?.code === 'ECONNABORTED') {
                logger.warn('LLM request timed out');
                return { error: 'AI Analysis timed out, please try again later.' };
            }
            logger.error('LLM analysis failed:', e);
            return { error: `AI Analysis unavailable: ${e?.message || 'Unknown error'}` };
        }
    }

    *[Service.init]() {
        if (!this.config.apiKey) {
            logger.warn('AI Analyzer: apiKey not configured, service will run without analysis');
        }

        const terminalStatuses: number[] = [
            STATUS.STATUS_ACCEPTED,
            STATUS.STATUS_WRONG_ANSWER,
            STATUS.STATUS_TIME_LIMIT_EXCEEDED,
            STATUS.STATUS_MEMORY_LIMIT_EXCEEDED,
            STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED,
            STATUS.STATUS_RUNTIME_ERROR,
            STATUS.STATUS_COMPILE_ERROR,
            STATUS.STATUS_SYSTEM_ERROR,
            STATUS.STATUS_CANCELED,
            STATUS.STATUS_ETC,
            STATUS.STATUS_FORMAT_ERROR,
            STATUS.STATUS_HACK_SUCCESSFUL,
            STATUS.STATUS_HACK_UNSUCCESSFUL,
        ];

        yield this.ctx.on('record/change', async (rdoc) => {
            if (!rdoc) return;
            if (!rdoc.code) {
                logger.debug('record/change: no code in rdoc, skip (rid=%s)', rdoc._id);
                return;
            }
            if (!this.config.apiKey) {
                logger.debug('record/change: apiKey not configured, skip (rid=%s)', rdoc._id);
                return;
            }
            if (!terminalStatuses.includes(rdoc.status)) {
                logger.debug('record/change: status=%d not terminal, skip (rid=%s)', rdoc.status, rdoc._id);
                return;
            }
            if ((rdoc as any).aiAnalysis) {
                logger.debug('record/change: aiAnalysis already exists, skip (rid=%s)', rdoc._id);
                return;
            }

            logger.info('record/change: triggering AI analysis for rid=%s status=%d lang=%s', rdoc._id, rdoc.status, rdoc.lang);

            this.enqueue(async () => {
                try {
                    const pdocData = await ProblemModel.get(rdoc.domainId, rdoc.pid);
                    const title = pdocData?.title || `Problem ${rdoc.pid}`;
                    const content = (pdocData?.content || '').toString();

                    const result = await this.analyzeCode(
                        rdoc.code, rdoc.lang, title, content,
                        rdoc.status, rdoc.score,
                    );

                    const updatedRdoc = await RecordModel.update(
                        rdoc.domainId, rdoc._id,
                        { aiAnalysis: result as any },
                    );
                    if (updatedRdoc) {
                        this.ctx.broadcast('record/change', updatedRdoc);
                    }
                } catch (e) {
                    logger.error('Failed to analyze submission:', e);
                }
            });
        });

        this.ctx.i18n.load('zh', {
            'AI Code Analysis': 'AI 代码分析',
            'Feasibility Score': '可行性评分',
            'Suggestions': '改进建议',
            'Risks': '风险提示',
        });    }
}

export default AiAnalyzerService;