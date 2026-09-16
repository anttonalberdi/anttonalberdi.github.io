const HERO_ANIMALS = [
  {
    src: "assets/images/hero-frog-zdenet.jpg",
    alt: "A green tree frog on a dark background",
    width: 1400,
    height: 1050,
    position: "62% center",
  },
  {
    src: "assets/images/hero-lizard-akirevarga.jpg",
    alt: "A lizard among green leaves",
    width: 1400,
    height: 934,
    position: "center",
  },
  {
    src: "assets/images/hero-salamander-kathy-buscher.jpg",
    alt: "A black-and-yellow fire salamander",
    width: 1400,
    height: 1049,
    position: "60% center",
  },
  {
    src: "assets/images/hero-bird-balouriarajesh.jpg",
    alt: "A small brown bird perched on a wire",
    width: 1400,
    height: 912,
    position: "24% center",
  },
  {
    src: "assets/images/mbr-4-700x467.jpg",
    alt: "A wood mouse in its natural habitat",
    width: 700,
    height: 467,
    position: "center",
  },
];

function rotateHeroAnimal() {
  const image = document.querySelector("[data-hero-animal]");
  if (!image) return;

  let index = 0;

  try {
    const previousIndex = Number.parseInt(
      sessionStorage.getItem("hero-animal-index") ?? "",
      10,
    );

    if (Number.isInteger(previousIndex)) {
      index = (previousIndex + 1) % HERO_ANIMALS.length;
    }

    sessionStorage.setItem("hero-animal-index", String(index));
  } catch {
    index = Math.floor(Math.random() * HERO_ANIMALS.length);
  }

  const animal = HERO_ANIMALS[index];
  image.src = animal.src;
  image.alt = animal.alt;
  image.width = animal.width;
  image.height = animal.height;
  image.style.objectPosition = animal.position;
}

rotateHeroAnimal();
