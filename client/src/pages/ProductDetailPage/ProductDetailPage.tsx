import { useParams } from "react-router-dom";
import { PageSection } from "@/components/PageSection/PageSection";

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <PageSection
      title="Próximamente"
      subtitle={`Producto: ${slug ?? "(sin slug)"}`}
      width="narrow"
    >
      <p>Esta pantalla se construye en la siguiente entrega.</p>
    </PageSection>
  );
}
