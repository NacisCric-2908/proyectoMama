import Link from "next/link";
import { Tarjeta } from "@/components/ui";

export default function SinPermiso() {
  return (
    <Tarjeta titulo="Sin permiso">
      <p className="text-sm">No tiene permiso para ver esta página. Si cree que es un error, consulte con el administrador.</p>
      <Link href="/" className="mt-3 inline-block text-sm text-primario hover:underline">
        Ir al inicio
      </Link>
    </Tarjeta>
  );
}
