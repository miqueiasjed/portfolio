import { useForm, usePage } from '@inertiajs/react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Botao, Entrada, Selecao } from './Campos';
import { Modal } from './Modal';

const LiberarContexto = createContext({ abrir: () => {} });

/** abrir({ email }) mostra o modal "Liberar acesso" de qualquer tela do admin. */
export const useLiberar = () => useContext(LiberarContexto);

function Formulario({ emailInicial, onFechar }) {
    const { adminProdutos = [] } = usePage().props;
    const form = useForm({ email: emailInicial ?? '', produto: adminProdutos[0]?.slug ?? '' });

    function enviar(e) {
        e.preventDefault();
        form.post('/admin/liberar', {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => onFechar(),
        });
    }

    if (adminProdutos.length === 0) {
        return <p className="text-sm text-apoio">Cadastre um curso antes de liberar acesso.</p>;
    }

    return (
        <form onSubmit={enviar} className="space-y-4" noValidate>
            <Entrada
                rotulo="E-mail do aluno"
                type="email"
                required
                data-autofocus={emailInicial ? undefined : true}
                autoComplete="off"
                placeholder="nome@exemplo.com"
                value={form.data.email}
                onChange={(e) => form.setData('email', e.target.value)}
                erro={form.errors.email}
                dica={emailInicial ? null : 'Se ainda não tiver cadastro, ele é criado agora.'}
            />
            <Selecao
                rotulo="Produto"
                value={form.data.produto}
                onChange={(e) => form.setData('produto', e.target.value)}
                erro={form.errors.produto}
                data-autofocus={emailInicial ? true : undefined}
            >
                {adminProdutos.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.nome}</option>
                ))}
            </Selecao>
            <p className="text-xs text-apoio">Registra uma compra manual de valor zero e envia o link de acesso por e-mail.</p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
                <Botao type="submit" carregando={form.processing}>Liberar e enviar link</Botao>
            </div>
        </form>
    );
}

export function LiberarProvider({ children }) {
    const [estado, setEstado] = useState(null);

    const abrir = useCallback((opcoes = {}) => setEstado({ email: opcoes.email ?? '' }), []);
    const fechar = useCallback(() => setEstado(null), []);
    const valor = useMemo(() => ({ abrir }), [abrir]);

    return (
        <LiberarContexto.Provider value={valor}>
            {children}
            <Modal
                aberto={!!estado}
                onFechar={fechar}
                titulo="Liberar acesso"
                descricao={estado?.email ? `Para ${estado.email}` : 'Dá acesso a um produto sem passar pelo pagamento.'}
            >
                {estado && <Formulario emailInicial={estado.email} onFechar={fechar} />}
            </Modal>
        </LiberarContexto.Provider>
    );
}
