import Link from "next/link";
import { Tarjeta } from "@/components/ui";

export default function NoEncontrado() {
  return (
    <Tarjeta titulo="No encontrado">
      <p className="text-sm">El registro que busca no existe o fue eliminado.</p>
      <Link href="/ordenes" className="mt-3 inline-block text-sm text-primario hover:underline">
        Ver órdenes
      </Link>
    </Tarjeta>
  );
}
