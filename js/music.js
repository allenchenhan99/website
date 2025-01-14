const app = Vue.createApp({
    data() {
        return {
            sidebarOpen: false,
            isRotating: true
        };
    },
    methods: {
        toggleSidebar(open) {
            this.sidebarOpen = open;
        },
        toggleRotation() {
            this.isRotating = !this.isRotating;
        },
        handleContentClick(event) {
            if (this.sidebarOpen && !event.target.closest('.sidebar') && !event.target.closest('.open-btn')) {
                this.toggleSidebar(false);
            }
        }
    },
    mounted() {
        document.querySelector('.content').addEventListener('click', this.handleContentClick);
    },
    beforeUnmount() {
        document.querySelector('.content').removeEventListener('click', this.handleContentClick);
    }
});

app.mount('#app');
