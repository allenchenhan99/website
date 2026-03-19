const app = Vue.createApp({
    data() {
        return {
            darkMode: true,
            viewMode: 'grid',
            posts: []
        };
    },
    methods: {
        toggleTheme() {
            this.darkMode = !this.darkMode;
            localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
            this.applyTheme();
        },
        applyTheme() {
            document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        },
        loadPosts() {
            fetch('posts/music.json')
                .then(res => res.json())
                .then(data => { this.posts = data; })
                .catch(err => console.error('Error loading posts:', err));
        }
    },
    mounted() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.darkMode = savedTheme === 'dark';
        } else {
            this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        this.applyTheme();

        const savedView = localStorage.getItem('music-view');
        if (savedView) {
            this.viewMode = savedView;
        }

        this.loadPosts();
    },
    watch: {
        viewMode(val) {
            localStorage.setItem('music-view', val);
        }
    }
});

app.mount('#app');
