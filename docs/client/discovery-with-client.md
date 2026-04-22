# Discovery Call — Wife's Store

Goal: leave this conversation knowing *what* to build and *what NOT* to build for v1. Tech stack is already decided — don't ask about it. Keep it conversational, ~30–45 min.

Open with: *"I'm going to build this store for real. Before I write any code, I need to understand your business the way a client would brief a developer. There are no wrong answers — if you don't know something yet, that's useful too."*

---

## 1. The business (5 min)

- In one sentence, what do you sell and who buys it?
 Papeleria personalizada a:
 1. Emprendedores
 2. Negocios formales
 3. Mujeres (mamás)

- What products will you sell?
1. Sobres
2. Stickers 
3. Etiquetas de vino
4. Tarjetas de regalo

5. Diseños digitales personalizados (para v2)

- Why do customers pick your products over the alternatives? (the real reason, not the marketing one)
1. Por la calidad de los materiales y atención al detalle, el servicio durante el proceso de compra y venta es enfocado al cliente.

- What's working well today that the website must NOT break?
1. Que los clientes pueden escoger el diseño desde el catálogo y no hacen cambios en el diseño, solo en el texto que debe llevar.

## 2. How you sell today (5 min)

- Walk me through one recent sale from DM to delivery. Where does it get painful?
1. Los clientes envian mensaje a instagram y whatsapp
2. El cliente pide informes
3. Escoge el tipo de impresión (foil o a color) 
4. El cliente indica cantidad
5. Yo le paso el total del pedido (pido un anticipo del 50%) para agendar el pedido
6. Una vez agendado, le envío el catálogo para que escoja el diseño
7. Ya que elige el diseño, me envía el nombre que debe llevar el sobre personalizado
8. Acuerdo un tiempo de entrega
9. Recogen en la tienda o si es envio se solicita el restante del pedido más lo que cobre la paquetería.


- What % of sales come from Instagram vs. other channels?
1. Casi todos los clienten contactan por Instagram, pero de instagram los mando a whatsapp porque el catálogo estra en formato PDF y los clientes necesitan ver el PDF.

- What do you tell customers when they ask "do you have a website?"
1. Ningún cliente ha preguntado si tiene página web.
2. Algo que si me han preguntado mucho es sobre todos los servicios que ofrezco y quieren ver el portafolio de mis diseños, y los redirijo a mi instagram.

## 3. The products (5 min)

- Do products have variants (size, color, flavor)? How many per product on average?
1. si, 3 opciones de variantes por producto en promedio

- How often do you add new products or restock? Who updates that — you or me?
1. Cada 6 meses, lo actualizaría yo (el cliente)

- How do you take product photos today? Are they website-ready or do we need a photo session?
1. Si tengo suficientes fotos para subir a la pagina web.

## 4. Money & fulfillment (5 min)

- Payment: MercadoPago covers card + Oxxo + SPEI — is that enough, or do customers ask for transfer/cash on delivery?
1. MercadoPago y transferencia estaría bien.

- Shipping: do you ship nationwide, local only, or offer pickup? Flat rate, by weight, or free over $X?
1. El envio es solo nacional (México) y pickup (Solo en Saltillo, Coahuila).
2. Me cobran por tamaño, lo manejo en un sobre de 25x30cm 

- Who packs and ships orders, and how many per week can you realistically handle?
1. Yo (la clienta) lo hace todo manual, 10 envios a la semana máximo

## 5. Brand & feel (3 min)

- Show me 2–3 stores (any industry) whose vibe you'd want yours to feel like. Why those?
https://sugarpaper.com/
https://www.theatelier.com.mx/

- Is there a logo, color palette, or fonts I should use, or am I choosing?
1. Ella me va a dar todo.

## 6. Success & scope (5 min)

- Six months after launch, how do you know this was worth it? (sales number, hours saved, something else?)
1. Para mi, lo mas importante sería que me ahorre el tiempo de contestar mensajes para dar informes y todo ese rollo. (en pocas palabras, automatizar el proceso de venta)

- If we had to cut the project in half to launch sooner, what's the one thing that absolutely must be there on day one?
1. El display del catalogo de mis servicios (mostrar el portafolio de trabajos que hago)

- What's the *next* thing you'd want after launch — so I can design for it without building it now?
1. Agregar invitaciones digitales, implementar tipos de invitaciones por categorias (infantiles principalmente, tener una base y cambiar variables, como el personaje, colores y datos)

---

## What I listen for (not to ask)

- **Red flags on scope:** wholesale pricing, B2B accounts, subscriptions, multi-vendor, loyalty points → all push to v2 or v3.
- **Hidden requirements:** bilingual content, invoicing/CFDI, return policy, stock at multiple locations.
- **Decisions she's outsourcing to me:** shipping rules, product categorization, SEO copy. Note them — these become my homework, not hers.

## After the call

- Write a 1-page summary and send it to her the same day. "Here's what I heard — correct me."
- Lock v1 scope against §4 of `wife-store-tech-roadmap.md`. Anything new goes to a v2 list, not into v1.
- Only then start Docker + repo setup.
