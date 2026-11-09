import { Head, useForm } from '@inertiajs/react';
import { Ponto } from '../../Layout';

const campo = 'w-full bg-transparent border px-4 py-3 outline-none transition-colors focus:border-papel';

export default function Entrar() {
    const { data, setData, post, processing, errors } = useForm({ email: '', senha: '' });

    return (
        <div className="admin min-h-screen bg-grafite text-papel flex flex-col">
            <Head title="Administração" />
            <header className="px-6 py-6">
                <p className="text-sm font-medium tracking-wide">Miquéias Mesquita</p>
                <p className="rotulo !text-[10px]">Membros · Administração</p>
            </header>
            <main className="flex-1 flex items-center justify-center px-6 pb-16">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        post('/admin/entrar');
                    }}
                    className="w-full max-w-sm border-t border-filete pt-10"
                >
                    <p className="rotulo mb-4">Administração</p>
                    <h1 className="text-4xl font-medium mb-8">Entrar<Ponto /></h1>

                    <label className="rotulo block mb-2" htmlFor="email">E-mail</label>
                    <input
                        id="email"
                        type="email"
                        required
                        autoFocus
                        autoComplete="username"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? 'entrar-erro' : undefined}
                        className={`${campo} mb-5 ${errors.email ? 'border-caneta' : 'border-filete'}`}
                    />

                    <label className="rotulo block mb-2" htmlFor="senha">Senha</label>
                    <input
                        id="senha"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={data.senha}
                        onChange={(e) => setData('senha', e.target.value)}
                        className={`${campo} border-filete`}
                    />

                    {errors.email && (
                        <p id="entrar-erro" role="alert" className="text-caneta text-sm mt-3">
                            {errors.email}
                        </p>
                    )}

                    <button type="submit" disabled={processing} className="btn-claro mt-8 w-full text-center cursor-pointer disabled:opacity-60">
                        {processing ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </main>
        </div>
    );
}
