import {
    Context, Logger, ProblemModel, RecordModel, Schema, Service, superagent,
} from 'hydrooj';

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
    0: 'Waiting',
    1: 'Accepted',
    2: 'Wrong Answer',
    3: 'Time Limit Exceeded',
    4: 'Memory Limit Exceeded',
    5: 'Output Limit Exceeded',
    6: 'Runtime Error',
    7: 'Compile Error',
    8: 'System Error',
    9: 'Canceled',
    10: 'Skipped',
    11: 'Hack Successful',
    12: 'Hack Unsuccessful',
    13: 'Format Error',
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
        apiKey: Schema.string().role('secret').default(''),
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
                    max_tokens: 1024,
                })
                .timeout(this.config.timeout);

            const body = res.body || res.text ? JSON.parse(res.text || res.body) : null;
            if (!body?.choices?.[0]?.message?.content) {
                throw new Error('Empty response from LLM');
            }
            const raw = body.choices[0].message.content;
            let parsed: any;
            try {
                parsed = JSON.parse(raw);
            } catch {
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
                else throw new Error('Not valid JSON');
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

        yield this.ctx.on('record/change', async (rdoc) => {
            if (!rdoc?.code || !this.config.apiKey) return;
            const terminalStatuses = [1,2,3,4,5,6,7,8,9,10,13];
            if (!terminalStatuses.includes(rdoc.status)) return;
            if (rdoc.aiAnalysis) return;

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
                        { $set: { aiAnalysis: result as any } },
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
        });
    }
}

export default AiAnalyzerService;