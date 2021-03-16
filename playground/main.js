import { createApp, h } from '../packages/runtime-dom/src/index';

const app = createApp({
    data() {
        return {
            title: 'hello',
        };
    },
    render() {
        return <span>{this.title}</span>;
    },
});

app.mount('#app');
