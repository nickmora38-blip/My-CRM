// UIRenderer.js — renders HTML strings for all CRM list views

const UIRenderer = {

  // ── Helpers ──────────────────────────────────────────────────────────────

  escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  renderBadge(value) {
    const map = {
      yes: ['badge-yes', 'Yes'],
      no:  ['badge-no',  'No'],
      na:  ['badge-na',  'N/A'],
    };
    const [cls, label] = map[value] || map.na;
    return `<span class="badge ${cls}">${label}</span>`;
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────

  renderRecentLead(lead) {
    return `
      <div style="background:#1a1a1a;padding:0.7rem 1rem;border-radius:6px;
                  margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong style="color:#DC143C">${this.escape(lead.name)}</strong>
          <span style="color:#888;font-size:0.82rem;margin-left:0.5rem">${this.escape(lead.company)}</span>
        </div>
        <span class="lead-stage">${this.escape(lead.stage)}</span>
      </div>`;
  },

  // ── Leads ─────────────────────────────────────────────────────────────────

  renderLeadCard(lead) {
    return `
      <div class="lead-card">
        <div class="lead-info">
          <h3>${this.escape(lead.name)}</h3>
          <p>📧 ${this.escape(lead.email)}</p>
          <p>📞 ${this.escape(lead.phone)}</p>
          <p>🏢 ${this.escape(lead.company)}</p>
          ${lead.notes ? `<p style="color:#888;margin-top:0.4rem;font-size:0.85rem">${this.escape(lead.notes)}</p>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.5rem">
          <span class="lead-stage">${this.escape(lead.stage)}</span>
          <button class="btn btn-primary"
                  onclick="deleteLead('${this.escape(lead.id)}')"
                  style="font-size:0.8rem;padding:0.35rem 0.7rem">Delete</button>
        </div>
      </div>`;
  },

  // ── Conditions ────────────────────────────────────────────────────────────

  renderConditionCard(condition) {
    // 9 radio-button fields → show Yes/No/N/A badge
    const radioFields = [
      { key: 'deposit',         label: 'Deposit' },
      { key: 'cv',              label: 'CV' },
      { key: 'paystub',         label: 'Paystub' },
      { key: 'w2',              label: 'W2' },
      { key: 'taxes',           label: 'Taxes' },
      { key: 'landDeed',        label: 'Land Deed' },
      { key: 'landLocation',    label: 'Land Location' },
      { key: 'siteInspection',  label: 'Site Inspection' },
      { key: 'deliveryRequest', label: 'Delivery Request' },
    ];

    const radioHtml = radioFields.map(f => `
      <div class="condition-detail">
        <div class="label">${f.label}</div>
        <div class="value">${this.renderBadge(condition[f.key])}</div>
      </div>`).join('');

    // 3 text/date fields → show plain text value
    const blank = '<span style="color:#555">—</span>';

    const textHtml = `
      <div class="condition-detail">
        <div class="label">Estimated Gross</div>
        <div class="value text-value">${condition.estimatedGross ? this.escape(condition.estimatedGross) : blank}</div>
      </div>
      <div class="condition-detail">
        <div class="label">Offline Date</div>
        <div class="value text-value">${condition.offlineDate ? this.escape(condition.offlineDate) : blank}</div>
      </div>
      <div class="condition-detail">
        <div class="label">COCS</div>
        <div class="value text-value">${condition.cocs ? this.escape(condition.cocs) : blank}</div>
      </div>`;

    const notesHtml = condition.notes
      ? `<div style="margin-top:1rem;padding-top:0.9rem;border-top:1px solid #222;
                     color:#aaa;font-size:0.88rem">
           <strong style="color:#888">Notes:</strong> ${this.escape(condition.notes)}
         </div>`
      : '';

    const date = condition.createdAt
      ? new Date(condition.createdAt).toLocaleDateString()
      : '';

    return `
      <div class="condition-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <h3>${this.escape(condition.leadName)}</h3>
          <div style="display:flex;gap:0.75rem;align-items:center">
            <span style="color:#555;font-size:0.8rem">${date}</span>
            <button class="btn btn-primary"
                    onclick="deleteCondition('${this.escape(condition.id)}')"
                    style="font-size:0.8rem;padding:0.35rem 0.7rem">Delete</button>
          </div>
        </div>
        <div class="condition-details">
          ${radioHtml}
          ${textHtml}
        </div>
        ${notesHtml}
      </div>`;
  },

  // ── Pipeline ──────────────────────────────────────────────────────────────

  renderPipelineColumn(stage, label, leads) {
    const cards = leads.length
      ? leads.map(l => `
          <div class="pipeline-card">
            <strong style="color:#DC143C;font-size:0.9rem">${this.escape(l.name)}</strong>
            <div style="color:#777;font-size:0.8rem;margin-top:0.2rem">${this.escape(l.company)}</div>
          </div>`).join('')
      : '<p style="color:#555;font-size:0.85rem">No leads</p>';

    return `
      <div class="pipeline-column">
        <h3>${this.escape(label)}
          <span style="color:#666;font-weight:400;font-size:0.82rem">(${leads.length})</span>
        </h3>
        ${cards}
      </div>`;
  },

  // ── Logistics ─────────────────────────────────────────────────────────────

  renderLogisticsCard(job) {
    const statusColors = {
      'scheduled':   { bg: '#0d1e2e', color: '#6699ff' },
      'in-progress': { bg: '#2e2200', color: '#ffaa00' },
      'completed':   { bg: '#0d2e0d', color: '#4caf50' },
      'on-hold':     { bg: '#2e0d2e', color: '#cc88ff' },
    };
    const sc = statusColors[job.status] || { bg: '#2a2a2a', color: '#aaa' };

    return `
      <div class="logistics-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">
          <div>
            <h3 style="color:#DC143C;margin-bottom:0.5rem">Job: ${this.escape(job.jobId)}</h3>
            <p style="color:#aaa;font-size:0.88rem">📍 ${this.escape(job.siteLocation)}</p>
            <p style="color:#aaa;font-size:0.88rem">🔧 ${this.escape(job.workType)}</p>
            ${job.startDate ? `<p style="color:#aaa;font-size:0.88rem">📅 Start: ${this.escape(job.startDate)}</p>` : ''}
            ${job.endDate   ? `<p style="color:#aaa;font-size:0.88rem">📅 End: ${this.escape(job.endDate)}</p>`   : ''}
            ${job.notes ? `<p style="color:#777;font-size:0.85rem;margin-top:0.4rem">${this.escape(job.notes)}</p>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.5rem;flex-shrink:0">
            <span style="background:${sc.bg};color:${sc.color};padding:0.2rem 0.75rem;
                         border-radius:12px;font-size:0.8rem;font-weight:600;text-transform:capitalize">
              ${this.escape(job.status)}
            </span>
            <button class="btn btn-primary"
                    onclick="deleteLogisticsJob('${this.escape(job.id)}')"
                    style="font-size:0.8rem;padding:0.35rem 0.7rem">Delete</button>
          </div>
        </div>
      </div>`;
  },
};

export default UIRenderer;
