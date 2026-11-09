import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

createRoot(document.getElementById('rotina')).render(<App csrf={csrf} />);
