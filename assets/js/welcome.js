/* This code was copied from Codepen <https://codepen.io/gpaul988/pen/vYPjzza> and revised by the developer for the purpose of this project */

const nav = document.getElementById('nav');

if (nav) {
  for (const text of nav.getElementsByTagName('li')) {
    text.onmousemove = (e) => {
      const rect = text.getBoundingClientRect();
      const img = text.querySelector('img');

      if (!img) return;

      img.style.left = `${e.clientX - rect.left}px`;
      img.style.top = `${e.clientY - rect.top}px`;
    };
  }
}
