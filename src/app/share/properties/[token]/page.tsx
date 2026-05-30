import { Building2, MapPin, Phone, Share2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicPropertyShare } from "@/services/public-property-share-service";

export default async function PublicPropertySharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const property = await getPublicPropertyShare(token);

  if (!property) {
    notFound();
  }
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`Sharing ${property.title} in ${property.location}: ${property.price}`)}`;

  return <main className="min-h-screen bg-[#f6f7f3]">
    <header className="border-b border-[#e2e7e2] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#176b4d] text-white"><Building2 size={18} /></div><div><p className="text-sm font-bold tracking-[-0.04em]">EstateFlow</p><p className="text-[9px] font-bold tracking-[0.2em] text-[#8d9a95]">PROPERTY SHARE</p></div></div>
        <span className="rounded-full bg-[#e7f3ed] px-3 py-1.5 text-[10px] font-bold text-[#176b4d]">Shared by {property.sharedBy}</span>
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="overflow-hidden rounded-3xl border border-[#e1e6e1] bg-white shadow-[0_16px_50px_rgba(37,67,56,0.08)]">
        <div className="grid gap-2 bg-[#edf1ed] md:grid-cols-[1.55fr_0.8fr]">
          <PropertyImage url={property.images[0]} title={property.title} large />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            <PropertyImage url={property.images[1] ?? property.images[0]} title={property.title} />
            <PropertyImage url={property.images[2] ?? property.images[0]} title={property.title} />
          </div>
        </div>
        <div className="p-5 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8c9893]">{property.type}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-[-0.065em] text-[#20312b]">{property.title}</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-[#74817c]"><MapPin size={15} />{property.location}</p></div><p className="text-xl font-bold tracking-[-0.04em] text-[#176b4d]">{property.price}</p></div>
          <p className="mt-7 max-w-3xl text-sm leading-7 text-[#67756f]">{property.description}</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="tel:+919876500001" className="flex h-11 items-center gap-2 rounded-xl bg-[#176b4d] px-4 text-xs font-bold text-white"><Phone size={15} />Call property advisor</a><a href={whatsappShareUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl border border-[#dfe5df] bg-white px-4 text-xs font-bold text-[#596862]"><Share2 size={15} />Share this property</a></div>
        </div>
      </section>
    </div>
  </main>;
}

function PropertyImage({ url, title, large = false }: { url?: string; title: string; large?: boolean }) {
  return <div role="img" aria-label={`${title} photo`} className={`${large ? "min-h-64 md:min-h-[430px]" : "min-h-36"} bg-[#dfe7e2] bg-cover bg-center`} style={url ? { backgroundImage: `url(${url})` } : undefined} />;
}
