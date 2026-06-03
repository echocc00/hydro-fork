import {
    _, Context, DocumentModel, Filter, Handler,
    NumberKeys, ObjectId, param, PERM, PRIV, Types, UserModel,
} from 'hydrooj';

export const TYPE_VIDEO = 80 as const;

// Define custom PERM bits (use unused positions)
const PERM_VIEW_VIDEO = 1n << 71n;
const PERM_CREATE_VIDEO = 1n << 72n;
const PERM_EDIT_VIDEO = 1n << 73n;

// Register permissions in admin panel (mutable PERMS array)
const hydroBuiltin = require('hydrooj/src/model/builtin');
if (hydroBuiltin.PERMS) {
    hydroBuiltin.PERMS.push(
        { family: 'perm_video', key: PERM_VIEW_VIDEO, desc: 'View videos' },
        { family: 'perm_video', key: PERM_CREATE_VIDEO, desc: 'Create and upload videos' },
        { family: 'perm_video', key: PERM_EDIT_VIDEO, desc: 'Edit any videos' },
    );
}

declare module 'hydrooj' {
    interface Model {
        video: typeof VideoModel;
    }
    interface DocType {
        [TYPE_VIDEO]: VideoDoc;
    }
}

interface VideoDoc {
    docType: 80;
    docId: ObjectId;
    title: string;
    url: string;
    description: string;
    category: string;
    owner: number;
    views: number;
    updateAt: Date;
    nReply: number;
    reply: any[];
}

class VideoModel {
    static async add(owner: number, title: string, url: string, description: string, category: string): Promise<ObjectId> {
        const payload: Partial<VideoDoc> = {
            title,
            url,
            description,
            category,
            owner,
            views: 0,
            nReply: 0,
            updateAt: new Date(),
        };
        const res = await DocumentModel.add(
            'system', payload.description, payload.owner, TYPE_VIDEO,
            null, null, null, _.omit(payload, ['description', 'owner']),
        );
        return res;
    }

    static async get(did: ObjectId): Promise<VideoDoc> {
        return await DocumentModel.get('system', TYPE_VIDEO, did);
    }

    static edit(did: ObjectId, title: string, url: string, description: string, category: string): Promise<VideoDoc> {
        return DocumentModel.set('system', TYPE_VIDEO, did, { title, url, description, category, updateAt: new Date() });
    }

    static inc(did: ObjectId, key: NumberKeys<VideoDoc>, value: number): Promise<VideoDoc | null> {
        return DocumentModel.inc('system', TYPE_VIDEO, did, key, value);
    }

    static del(did: ObjectId): Promise<never> {
        return Promise.all([
            DocumentModel.deleteOne('system', TYPE_VIDEO, did),
            DocumentModel.deleteMultiStatus('system', TYPE_VIDEO, { docId: did }),
        ]) as any;
    }

    static count(query: Filter<VideoDoc>) {
        return DocumentModel.count('system', TYPE_VIDEO, query);
    }

    static getMulti(query: Filter<VideoDoc> = {}) {
        return DocumentModel.getMulti('system', TYPE_VIDEO, query).sort({ _id: -1 });
    }
}

global.Hydro.model.video = VideoModel;

// --- Handlers ---

class VideoMainHandler extends Handler {
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, page = 1) {
        const [docs, count] = await this.ctx.db.paginate(
            VideoModel.getMulti({}),
            page,
            12,
        );
        this.response.template = 'video_main.html';
        this.response.body = {
            docs,
            count,
            page,
            PERM_CREATE_VIDEO,
        };
    }
}

class VideoDetailHandler extends Handler {
    @param('vid', Types.ObjectId)
    async get(domainId: string, vid: ObjectId) {
        const doc = await VideoModel.get(vid);
        if (!doc) {
            this.response.status = 404;
            return;
        }
        const udoc = await UserModel.getById(domainId, doc.owner);
        await VideoModel.inc(vid, 'views', 1);
        this.response.template = 'video_detail.html';
        this.response.body = {
            doc,
            udoc,
            PERM_EDIT_VIDEO,
        };
    }
}

class VideoEditHandler extends Handler {
    @param('vid', Types.ObjectId, true)
    async get(domainId: string, vid?: ObjectId) {
        const doc = vid ? await VideoModel.get(vid) : null;
        this.response.template = 'video_edit.html';
        this.response.body = {
            doc,
            PERM_EDIT_VIDEO,
        };
    }

    @param('title', Types.Content)
    @param('url', Types.Content)
    @param('description', Types.Content, true)
    @param('category', Types.Title, true)
    async postCreate(domainId: string, title: string, url: string, description = '', category = '未分类') {
        const did = await VideoModel.add(this.user._id, title, url, description, category);
        this.response.redirect = this.url('video_detail', { vid: did });
    }

    @param('vid', Types.ObjectId)
    @param('title', Types.Content)
    @param('url', Types.Content)
    @param('description', Types.Content, true)
    @param('category', Types.Title, true)
    async postUpdate(domainId: string, vid: ObjectId, title: string, url: string, description = '', category = '未分类') {
        await VideoModel.edit(vid, title, url, description, category);
        this.response.redirect = this.url('video_detail', { vid });
    }

    @param('vid', Types.ObjectId)
    async postDelete(domainId: string, vid: ObjectId) {
        await VideoModel.del(vid);
        this.response.redirect = this.url('video_main');
    }
}

export async function apply(ctx: Context) {
    ctx.Route('video_main', '/video', VideoMainHandler);
    ctx.Route('video_detail', '/video/detail/:vid', VideoDetailHandler);
    ctx.Route('video_create', '/video/create', VideoEditHandler, PRIV.PRIV_USER_PROFILE);
    ctx.Route('video_edit', '/video/:vid/edit', VideoEditHandler, PRIV.PRIV_USER_PROFILE);
    ctx.Route('video_main_paged', '/video/:page', VideoMainHandler);

    ctx.injectUI('Nav', 'video_main', (h) => ({
        icon: 'play',
        displayName: 'Video',
        url: h.url('video_main'),
    }), PRIV.PRIV_USER_PROFILE);

    ctx.i18n.load('zh', {
        'Video': '视频学习',
        'video_main': '视频列表',
        'video_detail': '视频详情',
        'video_edit': '编辑视频',
        'Video List': '视频列表',
        'Upload Video': '上传视频',
        'Title': '标题',
        'URL': '视频链接',
        'Description': '简介',
        'Category': '分类',
    });
    ctx.i18n.load('en', {
        'Video': 'Video',
        'video_main': 'Video List',
        'video_detail': 'Video Detail',
        'video_edit': 'Edit Video',
    });
}
