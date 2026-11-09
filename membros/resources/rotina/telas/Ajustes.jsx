// Tela Ajustes (`#/ajustes`). Por enquanto só a cópia de segurança; a edição
// dos ajustes entra acima dela no Plano 5. Fundo creme.

import CopiaDeSeguranca from '../ui/CopiaDeSeguranca.jsx';

export default function Ajustes() {
    return (
        <section aria-labelledby="ajustes-titulo" className="flex flex-col gap-6 py-2">
            <h1 id="ajustes-titulo" className="text-2xl font-medium">
                Ajustes
            </h1>
            <CopiaDeSeguranca />
        </section>
    );
}
