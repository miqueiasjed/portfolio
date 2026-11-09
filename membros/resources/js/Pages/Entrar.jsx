import { useForm, usePage } from '@inertiajs/react';
import Layout, { Ponto } from '../Layout';

export default function Entrar({ enviado = false, expirado = false }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });
    const { flash } = usePage().props;

    function enviar(e) {
        e.preventDefault();
        post('/entrar', { preserveScroll: true });
    }

    return (
        <Layout titulo="Entrar">
            <section className="max-w-md mx-auto px-6 py-20">
                <p className="rotulo mb-4">Área de membros</p>
                <h1 className="text-4xl font-medium leading-tight mb-4">
                    Entrar<Ponto />
                </h1>

                {expirado && (
                    <p className="mb-6 border-l-2 border-caneta-creme pl-4 text-[15px]">
                        Esse link já foi usado ou expirou. Peça um novo abaixo.
                    </p>
                )}

                {enviado ? (
                    <div className="border border-filete-claro bg-white p-6">
                        <p className="font-medium mb-2">Confira o seu e-mail.</p>
                        <p className="text-[15px] text-[#55575d]">
                            Se esse e-mail tiver uma compra, o link de entrada chega em instantes. Ele vale por 30
                            minutos. Olhe também a caixa de spam.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={enviar}>
                        <p className="text-[15px] text-[#55575d] mb-6">
                            Use o mesmo e-mail da compra. A gente manda um link de entrada, sem senha.
                        </p>
                        <label htmlFor="email" className="rotulo block mb-2">E-mail</label>
                        <input
                            id="email"
                            type="email"
                            required
                            autoFocus
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            className="w-full border border-filete-claro bg-white px-4 py-3 text-base outline-none focus:border-tinta"
                        />
                        {errors.email && <p className="text-caneta-creme text-sm mt-2">{errors.email}</p>}
                        <button type="submit" disabled={processing} className="btn mt-6 cursor-pointer disabled:opacity-60">
                            Receber link de entrada
                        </button>
                    </form>
                )}
            </section>
        </Layout>
    );
}
