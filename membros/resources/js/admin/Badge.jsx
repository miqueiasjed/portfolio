const CORES_STATUS = {
    paid: 'bg-[#E3EDE4] text-[#2F5A35] border-[#C3D8C6]',
    pending: 'bg-[#F4ECD9] text-[#7A5A12] border-[#E5D5AE]',
    canceled: 'bg-creme text-apoio border-filete-claro',
    refunded: 'bg-[#F6E3DF] text-caneta-creme border-[#EBC5BE]',
};

const ROTULOS_STATUS = { paid: 'Paga', pending: 'Pendente', canceled: 'Cancelada', refunded: 'Reembolsada' };

/** Situação da compra com cor própria e um ponto, para não depender só da cor. */
export function BadgeStatus({ status, rotulo }) {
    return (
        <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CORES_STATUS[status] ?? CORES_STATUS.canceled}`}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
            {rotulo ?? ROTULOS_STATUS[status] ?? status}
        </span>
    );
}

/** Etiqueta neutra (produto, rascunho, etc.). */
export function Chip({ children, tom = 'neutro', title }) {
    const tons = {
        neutro: 'bg-white text-tinta border-filete-claro',
        escuro: 'bg-grafite text-papel border-grafite',
        alerta: 'bg-[#F4ECD9] text-[#7A5A12] border-[#E5D5AE]',
        ok: 'bg-[#E3EDE4] text-[#2F5A35] border-[#C3D8C6]',
        apagado: 'bg-creme text-apoio border-filete-claro',
    };
    return (
        <span title={title} className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs whitespace-nowrap ${tons[tom]}`}>
            {children}
        </span>
    );
}
