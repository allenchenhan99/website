const app = Vue.createApp({
    data() {
        return {
            sidebarOpen: false
        };
    },
    methods: {
        toggleSidebar(open) {
            this.sidebarOpen = open;
        }
    }
});

app.mount('#app');
