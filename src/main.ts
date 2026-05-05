import { App } from '@/app';

const container = document.getElementById('app');
if (!container) throw new Error('main: #app container missing');

const app = new App(container);
app.start();
