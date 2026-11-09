import { Head, useForm } from '@inertiajs/react';
import { Ponto } from '../../Layout';

export default function Entrar() {
    const { data, setData, post, processing, errors } = useForm({ email: '', senha: '' });

    return (
        <div className="min-h-screen bg-grafite text-papel flex items-center justify-center px-6">
            <Head title="Administração" />
            <form
                onSubmit={(e) => { e.preventDefault(); post('/admin/entrar'); }}
                className="w-full max-w-sm"
            >
                <p className="rotulo mb-4">Administração</p>
                <h1 className="text-4xl font-medium mb-8">Entrar<Ponto /></h1>

                <label className="rotulo block mb-2" htmlFor="email">E-mail</label>
                <input id="email" type="email" required autoFocus value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="w-full bg-transparent border border-filete px-4 py-3 mb-4 outline-none focus:border-papel" />

                <label className="rotulo block mb-2" htmlFor="senha">Senha</label>
                <input id="senha" type="password" required value={data.senha}
                    onChange={(e) => setData('senha', e.target.value)}
                    className="w-full bg-transparent border border-filete px-4 py-3 outline-none focus:border-papel" />

                {errors.email && <p className="text-caneta text-sm mt-3">{errors.email}</p>}

                <button type="submit" disabled={processing} className="btn-claro mt-8 cursor-pointer disabled:opacity-60">
                    Entrar
                </button>
            </form>
        </div>
    );
}
