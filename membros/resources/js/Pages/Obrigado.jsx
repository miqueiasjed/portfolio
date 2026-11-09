import { Link } from '@inertiajs/react';
import Layout, { Ponto } from '../Layout';

export default function Obrigado({ paga, produto }) {
    return (
        <Layout titulo="Obrigado" escuro>
            <section className="max-w-2xl mx-auto px-6 py-24">
                <p className="rotulo mb-4">{produto ?? 'Sua compra'}</p>
                <h1 className="text-4xl sm:text-5xl font-medium leading-tight mb-6">
                    {paga ? 'Pagamento confirmado' : 'Recebemos o seu pedido'}
                    <Ponto />
                </h1>
                <p className="text-lg text-apoio max-w-xl">
                    {paga
                        ? 'O link de acesso já foi para o seu e-mail. Clique nele para entrar na sua área.'
                        : 'Assim que o pagamento for confirmado, o link de acesso chega no seu e-mail. No Pix e no cartão isso costuma levar poucos minutos.'}
                </p>
                <p className="text-sm text-apoio mt-6">Não chegou? Olhe a caixa de spam ou peça um link novo.</p>
                <div className="mt-10">
                    <Link href="/entrar" className="btn-claro">Pedir link de entrada</Link>
                </div>
            </section>
        </Layout>
    );
}
