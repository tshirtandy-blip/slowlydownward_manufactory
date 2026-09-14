import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding staff accounts…");
  const password = await bcrypt.hash("password123", 12);

  const staff = [
    { name: "Andy (Admin)", email: "admin@slowlydownward.co.uk", role: "ADMIN" as const },
    { name: "Sales Sam", email: "sales@slowlydownward.co.uk", role: "SALES" as const },
    { name: "Stock Steph", email: "stock@slowlydownward.co.uk", role: "STOCK" as const },
    { name: "Packer Pat", email: "packer@slowlydownward.co.uk", role: "PACKER" as const },
  ];
  for (const s of staff) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, passwordHash: password },
    });
  }

  console.log("Seeding collection & prints…");
  const collection = await prisma.collection.upsert({
    where: { slug: "the-holloway-series" },
    update: {},
    create: {
      title: "The Holloway Series",
      slug: "the-holloway-series",
      description: "New screenprints exploring sunken lanes and old paths.",
      published: true,
    },
  });

  const printsData = [
    {
      title: "Ursa Occasus",
      slug: "ursa-occasus",
      priceMinor: 15000,
      editionSize: 200,
      technique: "Screenprint, 6 colours",
      dimensions: "560 x 760mm",
      year: 2026,
      description: "A study of the bear descending into the western sky.",
      soldCount: 12,
    },
    {
      title: "Occupied Fortune",
      slug: "occupied-fortune",
      priceMinor: 9900,
      editionSize: 150,
      technique: "Screenprint, 4 colours",
      dimensions: "420 x 594mm",
      year: 2025,
      description: "From the Holloway series.",
      soldCount: 150, // sold out example
    },
    {
      title: "Nether Edge",
      slug: "nether-edge",
      priceMinor: 12000,
      editionSize: 100,
      technique: "Linocut",
      dimensions: "500 x 700mm",
      year: 2026,
      description: "A quiet, worn woodblock print.",
      soldCount: 3,
    },
  ];

  for (const [idx, p] of printsData.entries()) {
    const existing = await prisma.print.findUnique({ where: { slug: p.slug } });
    if (existing) continue;

    // All copies of one edition are stored in the same drawer, so this is a
    // single field on the print rather than something to set per copy.
    const drawerLocation = `C${idx + 1}-D1`;

    const print = await prisma.print.create({
      data: {
        title: p.title,
        slug: p.slug,
        priceMinor: p.priceMinor,
        editionSize: p.editionSize,
        technique: p.technique,
        dimensions: p.dimensions,
        year: p.year,
        description: p.description,
        published: true,
        collectionId: collection.id,
        drawerLocation,
      },
    });

    // One bulk insert for every copy, rather than one round trip per copy —
    // this is what made seeding slow before, especially over a network
    // connection to a hosted database.
    await prisma.edition.createMany({
      data: Array.from({ length: p.editionSize }).map((_, i) => {
        const number = i + 1;
        const sold = number <= p.soldCount;
        return {
          printId: print.id,
          number,
          status: sold ? "SOLD" : "AVAILABLE",
          soldAt: sold ? new Date() : null,
        };
      }),
    });
  }

  console.log("Seeding storefront pages…");
  await prisma.page.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      title: "Home",
      status: "PUBLISHED",
      blocks: [
        {
          id: "home-hero",
          type: "hero",
          eyebrow: "Stanley Donwood — Limited Editions",
          heading: "Prints made slowly, released rarely, gone for good.",
          subheading:
            "Every print is hand-numbered from a strictly limited edition. When the edition sells out, it is not reprinted.",
        },
        { id: "home-prints", type: "printGrid", mode: "all" },
      ],
    },
  });

  await prisma.page.upsert({
    where: { slug: "about" },
    update: {},
    create: {
      slug: "about",
      title: "About",
      status: "PUBLISHED",
      blocks: [
        {
          id: "about-text",
          type: "text",
          body:
            "Slowly Downward is a small studio press producing limited edition prints.\n\nEach design is worked by hand, printed in a single run, and never repeated. Once an edition is sold out, it stays that way — the plates and screens are retired, not reprinted.\n\nThis page, like every page on this site, is built and edited from Admin → Pages. Add, remove, and rearrange blocks there to change what visitors see here.",
        },
        {
          id: "about-quote",
          type: "quote",
          text: "A print is a small, stubborn object. It refuses to be infinite.",
        },
      ],
    },
  });

  // The three "Information" links in the site footer — created once here so
  // they exist and are linkable immediately, then edited like any other
  // page from Admin → Pages from then on. `update: {}` means re-running
  // this seed never overwrites content you've already edited.
  const footerPages = [
    {
      slug: "shipping-returns",
      title: "Shipping & Returns",
      label: "Shipping & returns",
      body:
        "Add your real shipping and returns policy here — Admin → Pages → Shipping & Returns.\n\nFor example: which countries you ship to, how long delivery takes, what happens if a print arrives damaged, and how returns or exchanges work.",
    },
    {
      slug: "authenticity-care",
      title: "Authenticity & Care",
      label: "Authenticity & care",
      body:
        "Add your real authenticity and care information here — Admin → Pages → Authenticity & Care.\n\nFor example: how each print is numbered and catalogued, what a certificate of authenticity includes, and how to store or frame a print to keep it in good condition.",
    },
    {
      slug: "contact",
      title: "Contact",
      label: "Contact",
      body:
        "Add your real contact details here — Admin → Pages → Contact.\n\nFor example: an email address, response times, and a postal address if you accept returns by post.",
    },
  ];
  for (const [i, p] of footerPages.entries()) {
    const page = await prisma.page.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        status: "PUBLISHED",
        blocks: [{ id: `${p.slug}-text`, type: "text", body: p.body }],
      },
    });
    // The footer's "Information" column reads from FooterLink, not just from
    // the page existing — this is what actually puts a link to it in the
    // footer (see Admin > Settings > Footer). `update: {}` again means a
    // re-run won't undo a label edit or reordering you've made since.
    await prisma.footerLink.upsert({
      where: { pageId: page.id },
      update: {},
      create: { pageId: page.id, label: p.label, sortOrder: i },
    });
  }

  console.log("Seed complete. Staff logins (password: password123):");
  staff.forEach((s) => console.log(`  ${s.role.padEnd(7)} ${s.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
