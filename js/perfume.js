const app = Vue.createApp({
    data() {
        return {
            darkMode: true
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
        }
    },
    mounted() {
        const saved = localStorage.getItem('theme');
        if (saved) {
            this.darkMode = saved === 'dark';
        } else {
            this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        this.applyTheme();
    }
});

app.mount('#app');
