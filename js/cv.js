const app = Vue.createApp({
    data() {
        return {
            darkMode: true,
            lang: 'en'
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
        toggleLang() {
            this.lang = this.lang === 'en' ? 'zh' : 'en';
            localStorage.setItem('cv-lang', this.lang);
        }
    },
    mounted() {
        // Load theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.darkMode = savedTheme === 'dark';
        } else {
            this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        this.applyTheme();

        // Load language
        const savedLang = localStorage.getItem('cv-lang');
        if (savedLang) {
            this.lang = savedLang;
        }
    }
});

app.mount('#app');
