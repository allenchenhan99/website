const app = Vue.createApp({
    data() {
        return {
            darkMode: true,
            filterMode: 'scent',
            activeFilter: 'All',
            posts: []
        };
    },
    computed: {
        filterOptions() {
            const options = ['All'];
            if (this.filterMode === 'scent') {
                const scents = new Set();
                this.posts.forEach(p => p.scents.forEach(s => scents.add(s)));
                options.push(...Array.from(scents).sort());
            } else {
                const brands = new Set();
                this.posts.forEach(p => brands.add(p.brand));
                options.push(...Array.from(brands).sort());
            }
            return options;
        },
        filteredPosts() {
            if (this.activeFilter === 'All') return this.posts;
            if (this.filterMode === 'scent') {
                return this.posts.filter(p => p.scents.includes(this.activeFilter));
            } else {
                return this.posts.filter(p => p.brand === this.activeFilter);
            }
        }
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
            fetch('posts/perfume.json')
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
        this.loadPosts();
    }
});

app.mount('#app');
