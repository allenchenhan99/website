document.addEventListener('DOMContentLoaded', () => {
    const imageContainer = document.querySelector('.image-container');
    const textContainer = document.querySelector('.text-container');
    const content = document.querySelector('.content');

    function adjustLayout() {
        if (window.innerWidth <= 768) {
            if (imageContainer.contains(textContainer)) {
                content.appendChild(textContainer);
            }
        } else {
            if (!imageContainer.contains(textContainer)) {
                imageContainer.appendChild(textContainer);
            }
        }
    }

    adjustLayout();
    window.addEventListener('resize', adjustLayout);
});

const app = Vue.createApp({
    data() {
        return {
            darkMode: true,
            isRotating: true
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
        toggleRotation() {
            this.isRotating = !this.isRotating;
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
