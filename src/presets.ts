// Built-in charity registry. A config opts in with `presets: ea`; its own
// `categories`, `impact` and `aliases` entries take precedence per recipient.
//
// Impact lines carry only figures with a citable source. Charities without a
// defensible per-dollar number get a category and aliases but no estimate: a
// blank is more honest than a guess.

export interface PresetImpact {
  cost_per_unit?: number;
  per_dollar?: number;
  share?: number;
  unit: string;
  icon?: string;
  source: string;
  note: string;
}

export interface PresetCharity {
  name: string;
  aliases?: string[]; // as they appear on statements, receipts, DAF grant histories
  impact?: PresetImpact[];
}

export interface Preset {
  description: string;
  categories: { name: string; charities: PresetCharity[] }[];
}

const GW_TOP = 'https://www.givewell.org/charities/top-charities';
const GW_LIFE = 'https://www.givewell.org/how-much-does-it-cost-to-save-a-life';
const lives = (note: string): PresetImpact => ({ cost_per_unit: 5000, unit: 'lives saved (expected)', source: GW_LIFE, note });

export const PRESETS: Record<string, Preset> = {
  ea: {
    description: 'Charities commonly recommended by GiveWell, Animal Charity Evaluators, Giving What We Can and EA Funds.',
    categories: [
      {
        name: 'Global health',
        charities: [
          {
            name: 'GiveWell',
            aliases: ['GiveWell Top Charities Fund', 'Top Charities Fund', 'GiveWell Maximum Impact Fund'],
            // Treated as Top Charities Fund money, split the way GiveWell directed its 2024
            // top-charity grants (AMF 50%, Malaria Consortium 28%, Helen Keller 18%, New Incentives 4%).
            impact: [
              lives("GiveWell's top-charity range is ~$3,000–5,500 per life; $5,000 used"),
              { share: 0.5, cost_per_unit: 6, unit: 'bed nets', source: GW_TOP, note: "AMF's share of GiveWell's 2024 top-charity grants (50%) at ~$6 per net delivered" },
              { share: 0.28, cost_per_unit: 7, unit: 'children protected from malaria for a season', source: GW_TOP, note: "Malaria Consortium's share (28%) at ~$7 per child per season" },
              { share: 0.18, cost_per_unit: 2, unit: 'child-years of vitamin A', source: GW_TOP, note: "Helen Keller Intl's share (18%) at ~$2 per child per year" },
              { share: 0.04, cost_per_unit: 146, unit: 'infants vaccinated', source: GW_TOP, note: "New Incentives' share (4%) at ~$146 per infant vaccinated" },
            ],
          },
          {
            name: 'GiveWell All Grants Fund',
            aliases: ['All Grants Fund'],
            impact: [lives('All Grants funds programs GiveWell judges at least as cost-effective as its top charities, not all lifesaving; $5,000 per life used')],
          },
          {
            name: 'Against Malaria Foundation',
            aliases: ['AMF'],
            impact: [lives("GiveWell's top-charity range is ~$3,000–5,500 per life; $5,000 used"), { cost_per_unit: 6, unit: 'bed nets', source: GW_TOP, note: '~$6 to provide one net (GiveWell); AMF quotes ~$2 for the net alone' }],
          },
          {
            name: 'Malaria Consortium',
            aliases: ['Malaria Consortium SMC'],
            impact: [lives("GiveWell's top-charity range is ~$3,000–5,500 per life; $5,000 used"), { cost_per_unit: 7, unit: 'children protected from malaria for a season', source: GW_TOP, note: '~$7 per child for a season of seasonal malaria chemoprevention (GiveWell)' }],
          },
          {
            name: 'Helen Keller Intl',
            aliases: ['Helen Keller International', 'Helen Keller Intl.', 'HKI'],
            impact: [lives("GiveWell's top-charity range is ~$3,000–5,500 per life; $5,000 used"), { cost_per_unit: 2, unit: 'child-years of vitamin A', source: GW_TOP, note: '~$2 to supplement a child for a year (GiveWell)' }],
          },
          {
            name: 'New Incentives',
            impact: [lives("GiveWell's top-charity range is ~$3,000–5,500 per life; $5,000 used"), { cost_per_unit: 146, unit: 'infants vaccinated', source: GW_TOP, note: '~$146 per infant vaccinated (GiveWell)' }],
          },
          {
            name: 'GiveDirectly',
            aliases: ['Give Directly'],
            impact: [{ per_dollar: 0.89, unit: 'dollars delivered to families in poverty', icon: 'cash', source: 'https://forum.effectivealtruism.org/posts/NnzGh2KpN2XYDqqvS/yes-we-have-costs', note: "GiveDirectly's own figure: 89% of funds for transfers reach recipients" }],
          },
          { name: 'Evidence Action', aliases: ['Dispensers for Safe Water', 'Deworm the World'] },
          { name: 'Global Health and Development Fund', aliases: ['EA Funds Global Health and Development Fund', 'EA Global Health and Development Fund'] },
        ],
      },
      {
        name: 'Animal welfare',
        charities: [
          { name: 'Animal Charity Evaluators', aliases: ['ACE', 'ACE Recommended Charity Fund', 'Recommended Charity Fund'] },
          { name: 'ACE Movement Grants', aliases: ['Movement Grants'] },
          { name: 'The Humane League', aliases: ['THL', 'Humane League'] },
          {
            name: 'Shrimp Welfare Project',
            aliases: ['SWP'],
            impact: [{ per_dollar: 1400, unit: 'shrimp helped per year', icon: 'fish', source: 'https://www.shrimpwelfareproject.org/shrimpact', note: "SWP's own estimate (range 1,000–2,000 per $ per year), mostly from humane-slaughter stunners" }],
          },
          { name: 'FarmKind' },
          { name: 'Animal Equality' },
          { name: 'The Good Food Institute', aliases: ['GFI', 'Good Food Institute'] },
          { name: 'Wild Animal Initiative', aliases: ['WAI'] },
          { name: 'Faunalytics' },
          { name: 'Fish Welfare Initiative', aliases: ['FWI'] },
          { name: 'Mercy For Animals', aliases: ['Mercy for Animals', 'MFA'] },
          { name: 'Sinergia Animal' },
          { name: 'Animal Welfare Fund', aliases: ['EA Funds Animal Welfare Fund', 'EA Animal Welfare Fund'] },
        ],
      },
      {
        name: 'Catastrophic risks',
        charities: [
          { name: 'Long-Term Future Fund', aliases: ['LTFF', 'EA Funds Long-Term Future Fund'] },
          { name: 'Nuclear Threat Initiative', aliases: ['NTI'] },
          { name: 'ALLFED', aliases: ['Alliance to Feed the Earth in Disasters'] },
          { name: 'Johns Hopkins Center for Health Security', aliases: ['Center for Health Security'] },
        ],
      },
      {
        name: 'Climate',
        charities: [
          { name: 'Clean Air Task Force', aliases: ['CATF'] },
          { name: 'Giving Green', aliases: ['Giving Green Fund'] },
          { name: 'Founders Pledge Climate Fund', aliases: ['Climate Change Fund'] },
        ],
      },
      {
        name: 'EA community',
        charities: [
          { name: 'Giving What We Can', aliases: ['GWWC'] },
          { name: 'EA Infrastructure Fund', aliases: ['EAIF', 'EA Funds Infrastructure Fund'] },
          { name: '80,000 Hours', aliases: ['80000 Hours', '80k'] },
          { name: 'Rethink Priorities' },
          { name: 'Centre for Effective Altruism', aliases: ['CEA', 'Center for Effective Altruism'] },
        ],
      },
    ],
  },
};
