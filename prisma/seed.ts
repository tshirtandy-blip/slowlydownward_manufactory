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

  for (const p of printsData) {
    const existing = await prisma.print.findUnique({ where: { slug: p.slug } });
    if (existing) continue;

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
      },
    });

    // Create editions, some pre-marked SOLD so the dashboard has something
    // to show, some filed into demo stock locations.
    for (let i = 1; i <= p.editionSize; i++) {
      const sold = i <= p.soldCount;
      const cabinet = Math.ceil(i / 40);
      const drawer = Math.ceil((i % 40 || 40) / 8);
      const code = `C${cabinet}-D${drawer}`;
      const location = await prisma.stockLocation.upsert({
        where: { code },
        update: {},
        create: { code },
      });

      await prisma.edition.create({
        data: {
          printId: print.id,
          number: i,
          status: sold ? "SOLD" : "AVAILABLE",
          soldAt: sold ? new Date() : null,
          locationId: sold ? undefined : location.id,
        },
      });
    }
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
