import { authStatus, logoutBtn } from '../shared/dom.js';
import { BRAND_MEDICINES } from '../services/brand-medicines.js';
import { OTHER_MEDICINES } from '../services/medicine-library.js';
import { PNF_MEDICINES } from '../services/pnf-medicines.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';
import { escapeHtml } from '../shared/utils.js';

const PAGE_SIZE = 25;
const SOURCE_LABELS = {
  pnf: 'PNF Essential Medicines List',
  brand: 'Common brand names (HSPS list)',
  other: 'Other common medicines',
};

const tableBody = document.getElementById('medicine-table-body');
const searchInput = document.getElementById('medicine-search');
const sourceFilter = document.getElementById('medicine-source-filter');
const pager = document.getElementById('medicine-pager');
const countLabel = document.getElementById('medicine-count');

const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9+]/g, '');

// One row per medicine: PNF generic names, brand names with their generic names,
// and the other common medicines that are not already in the PNF list.
function buildRows() {
  const pnfKeys = new Set(PNF_MEDICINES.map(normalize));
  const rows = [
    ...PNF_MEDICINES.map((name) => ({ name, type: 'Generic', generic: '', source: 'pnf' })),
    ...BRAND_MEDICINES.map(([brand, generic]) => ({
      name: brand,
      type: normalize(brand) === normalize(generic) ? 'Generic' : 'Brand',
      generic: normalize(brand) === normalize(generic) ? '' : generic,
      source: 'brand',
    })),
    ...OTHER_MEDICINES.filter((name) => !pnfKeys.has(normalize(name))).map((name) => ({ name, type: 'Generic', generic: '', source: 'other' })),
  ];
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

const ROWS = buildRows();
let currentPage = 1;

function matchingRows() {
  const query = normalize(searchInput.value);
  const source = sourceFilter.value;
  return ROWS.filter((row) => (source === 'all' || row.source === source)
    && (!query || normalize(row.name).includes(query) || normalize(row.generic).includes(query)));
}

function renderPager(total, pageCount) {
  pager.hidden = !total;
  if (!total) {
    pager.innerHTML = '';
    return;
  }
  const first = (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, total);
  pager.innerHTML = `
    <span class="pager-summary">Showing ${first}-${last} of ${total}</span>
    ${pageCount > 1 ? `
      <div class="pager-buttons">
        <button class="ghost-btn" type="button" data-page="1"${currentPage === 1 ? ' disabled' : ''}>First</button>
        <button class="ghost-btn" type="button" data-page="${currentPage - 1}"${currentPage === 1 ? ' disabled' : ''}>Previous</button>
        <span class="pager-summary">Page ${currentPage} of ${pageCount}</span>
        <button class="ghost-btn" type="button" data-page="${currentPage + 1}"${currentPage === pageCount ? ' disabled' : ''}>Next</button>
        <button class="ghost-btn" type="button" data-page="${pageCount}"${currentPage === pageCount ? ' disabled' : ''}>Last</button>
      </div>` : ''}
  `;
}

function render() {
  const rows = matchingRows();
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount);
  renderPager(rows.length, pageCount);

  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="4">No medicines match your search.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    .map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td><span class="badge ${row.type === 'Brand' ? 'pending' : 'reviewed'}">${row.type}</span></td>
        <td>${row.generic ? escapeHtml(row.generic) : '<span class="muted-cell">-</span>'}</td>
        <td>${SOURCE_LABELS[row.source]}</td>
      </tr>
    `)
    .join('');
}

bindLogoutButton(logoutBtn);
authStatus.textContent = 'Checking session...';

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser.email || 'user'}`;
  const counts = ROWS.reduce((total, row) => ({ ...total, [row.source]: (total[row.source] || 0) + 1 }), {});
  countLabel.textContent = `${ROWS.length} medicines: ${counts.pnf} from the PNF list, ${counts.brand} brand names, and ${counts.other || 0} other common medicines.`;

  const showFirstPage = () => {
    currentPage = 1;
    render();
  };
  searchInput.addEventListener('input', showFirstPage);
  sourceFilter.addEventListener('change', showFirstPage);
  pager.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (button && !button.disabled) {
      currentPage = Number(button.dataset.page);
      render();
    }
  });
  render();
}
