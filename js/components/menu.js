import { MENU_ITEMS } from '../core/constants.js';

export function renderMenu(menuList, currentMenuIndex) {
  menuList.innerHTML = '';
  MENU_ITEMS.forEach((item, idx) => {
    const active = idx === currentMenuIndex;
    const el = document.createElement('div');
    el.className = `card-item${active ? ' active' : ''}`;
    el.innerHTML = `
      <div class="card-info">
        <span class="card-title">${item.title}</span>
        <span class="card-sub">${item.sub}</span>
      </div>
    `;
    menuList.appendChild(el);
  });
}
