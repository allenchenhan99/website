const REPO_OWNER = 'allenchenhan99';
const REPO_NAME = 'website';
const MUSIC_PATH = 'posts/music.json';
const PERFUME_PATH = 'posts/perfume.json';

const app = Vue.createApp({
    data() {
        return {
            // Auth
            authenticated: false,
            tokenInput: '',
            token: '',
            loginError: '',
            connecting: false,

            // State
            activeTab: 'music',
            saving: false,
            toastMsg: '',

            // Data
            musicPosts: [],
            perfumePosts: [],
            musicSha: '',
            perfumeSha: '',

            // Music modal
            showMusicModal: false,
            editingMusicIndex: -1,
            musicForm: { title: '', tag: '', date: '', cover: '', excerpt: '' },

            // Perfume modal
            showPerfumeModal: false,
            editingPerfumeIndex: -1,
            perfumeForm: { brand: '', name: '', scentsInput: '', date: '', cover: '', excerpt: '' },
        };
    },
    mounted() {
        const saved = localStorage.getItem('admin_token');
        if (saved) {
            this.token = saved;
            this.verifyAndLoad();
        }
    },
    methods: {
        // ===== Auth =====
        async connect() {
            if (!this.tokenInput.trim()) {
                this.loginError = 'Please enter a token.';
                return;
            }
            this.connecting = true;
            this.loginError = '';
            this.token = this.tokenInput.trim();

            try {
                await this.verifyAndLoad();
                localStorage.setItem('admin_token', this.token);
                this.tokenInput = '';
            } catch (e) {
                this.loginError = 'Invalid token or no access to this repository.';
                this.token = '';
                this.authenticated = false;
            }
            this.connecting = false;
        },

        async verifyAndLoad() {
            // Verify token by fetching repo info
            const res = await this.ghApi(`/repos/${REPO_OWNER}/${REPO_NAME}`);
            if (!res.ok) throw new Error('Unauthorized');
            this.authenticated = true;

            // Load data
            await Promise.all([this.loadMusic(), this.loadPerfume()]);
        },

        logout() {
            localStorage.removeItem('admin_token');
            this.token = '';
            this.authenticated = false;
            this.musicPosts = [];
            this.perfumePosts = [];
        },

        // ===== GitHub API =====
        ghApi(path, options = {}) {
            return fetch(`https://api.github.com${path}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
        },

        async loadFile(path) {
            const res = await this.ghApi(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`);
            if (!res.ok) return { content: [], sha: '' };
            const data = await res.json();
            const decoded = JSON.parse(atob(data.content));
            return { content: decoded, sha: data.sha };
        },

        async saveFile(path, content, sha, message) {
            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 4))));
            const body = {
                message,
                content: encoded,
                sha,
            };
            const res = await this.ghApi(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            return data.content.sha;
        },

        // ===== Music =====
        async loadMusic() {
            const { content, sha } = await this.loadFile(MUSIC_PATH);
            this.musicPosts = content;
            this.musicSha = sha;
        },

        openMusicModal(index = -1) {
            this.editingMusicIndex = index;
            if (index >= 0) {
                const post = this.musicPosts[index];
                this.musicForm = { ...post };
            } else {
                this.musicForm = { title: '', tag: '', date: new Date().toISOString().slice(0, 10).replace(/-/g, '/'), cover: '', excerpt: '' };
            }
            this.showMusicModal = true;
        },

        async saveMusic() {
            if (!this.musicForm.title || !this.musicForm.excerpt) return;
            this.saving = true;

            try {
                if (this.editingMusicIndex >= 0) {
                    // Edit existing
                    this.musicPosts[this.editingMusicIndex] = {
                        ...this.musicPosts[this.editingMusicIndex],
                        ...this.musicForm,
                    };
                } else {
                    // Add new
                    const maxId = this.musicPosts.reduce((max, p) => Math.max(max, p.id || 0), 0);
                    this.musicPosts.unshift({
                        id: maxId + 1,
                        ...this.musicForm,
                    });
                }

                const action = this.editingMusicIndex >= 0 ? 'Update' : 'Add';
                this.musicSha = await this.saveFile(
                    MUSIC_PATH,
                    this.musicPosts,
                    this.musicSha,
                    `${action} music post: ${this.musicForm.title}`
                );

                this.showMusicModal = false;
                this.showToast('Music post saved & deployed!');
            } catch (e) {
                this.showToast('Error saving: ' + e.message);
            }
            this.saving = false;
        },

        async deleteMusic(index) {
            if (!confirm('Delete "' + this.musicPosts[index].title + '"?')) return;
            this.saving = true;

            try {
                const title = this.musicPosts[index].title;
                this.musicPosts.splice(index, 1);
                this.musicSha = await this.saveFile(
                    MUSIC_PATH,
                    this.musicPosts,
                    this.musicSha,
                    `Delete music post: ${title}`
                );
                this.showToast('Deleted & deployed!');
            } catch (e) {
                this.showToast('Error deleting: ' + e.message);
            }
            this.saving = false;
        },

        // ===== Perfume =====
        async loadPerfume() {
            const { content, sha } = await this.loadFile(PERFUME_PATH);
            this.perfumePosts = content;
            this.perfumeSha = sha;
        },

        openPerfumeModal(index = -1) {
            this.editingPerfumeIndex = index;
            if (index >= 0) {
                const item = this.perfumePosts[index];
                this.perfumeForm = {
                    brand: item.brand,
                    name: item.name,
                    scentsInput: (item.scents || []).join(', '),
                    date: item.date,
                    cover: item.cover || '',
                    excerpt: item.excerpt,
                };
            } else {
                this.perfumeForm = { brand: '', name: '', scentsInput: '', date: new Date().toISOString().slice(0, 10).replace(/-/g, '/'), cover: '', excerpt: '' };
            }
            this.showPerfumeModal = true;
        },

        async savePerfume() {
            if (!this.perfumeForm.brand || !this.perfumeForm.name) return;
            this.saving = true;

            try {
                const scents = this.perfumeForm.scentsInput
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s);

                const entry = {
                    brand: this.perfumeForm.brand,
                    name: this.perfumeForm.name,
                    scents,
                    date: this.perfumeForm.date,
                    cover: this.perfumeForm.cover,
                    excerpt: this.perfumeForm.excerpt,
                };

                if (this.editingPerfumeIndex >= 0) {
                    entry.id = this.perfumePosts[this.editingPerfumeIndex].id;
                    this.perfumePosts[this.editingPerfumeIndex] = entry;
                } else {
                    const maxId = this.perfumePosts.reduce((max, p) => Math.max(max, p.id || 0), 0);
                    entry.id = maxId + 1;
                    this.perfumePosts.unshift(entry);
                }

                const action = this.editingPerfumeIndex >= 0 ? 'Update' : 'Add';
                this.perfumeSha = await this.saveFile(
                    PERFUME_PATH,
                    this.perfumePosts,
                    this.perfumeSha,
                    `${action} perfume entry: ${this.perfumeForm.brand} — ${this.perfumeForm.name}`
                );

                this.showPerfumeModal = false;
                this.showToast('Perfume entry saved & deployed!');
            } catch (e) {
                this.showToast('Error saving: ' + e.message);
            }
            this.saving = false;
        },

        async deletePerfume(index) {
            const item = this.perfumePosts[index];
            if (!confirm('Delete "' + item.brand + ' — ' + item.name + '"?')) return;
            this.saving = true;

            try {
                this.perfumePosts.splice(index, 1);
                this.perfumeSha = await this.saveFile(
                    PERFUME_PATH,
                    this.perfumePosts,
                    this.perfumeSha,
                    `Delete perfume entry: ${item.brand} — ${item.name}`
                );
                this.showToast('Deleted & deployed!');
            } catch (e) {
                this.showToast('Error deleting: ' + e.message);
            }
            this.saving = false;
        },

        // ===== Utils =====
        showToast(msg) {
            this.toastMsg = msg;
            setTimeout(() => { this.toastMsg = ''; }, 2500);
        },
    }
});

app.mount('#app');
