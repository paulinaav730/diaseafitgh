import { GroupFunction, GtSubTeam, PersonType } from '../types';

export const GT_SUBTEAMS: GtSubTeam[] = [
  'Generales',
  'Logística',
  'RRPP',
  'GH',
  'Mercadeo',
  'Seguridad',
  'Carnival',
  'The Games',
];

export const DEFAULT_GROUP_FUNCTIONS: GroupFunction[] = [
  // GT → Logística
  {
    id: 'fn_gt_log_1',
    name: 'Montaje',
    category: 'GT',
    gtSubTeam: 'Logística',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_log_2',
    name: 'Apoyo logístico',
    category: 'GT',
    gtSubTeam: 'Logística',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_log_3',
    name: 'Desmontaje',
    category: 'GT',
    gtSubTeam: 'Logística',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → Generales
  {
    id: 'fn_gt_gen_1',
    name: 'Apoyo general',
    category: 'GT',
    gtSubTeam: 'Generales',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_gen_2',
    name: 'Orientación en campus',
    category: 'GT',
    gtSubTeam: 'Generales',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_gen_3',
    name: 'Distribución de insumos',
    category: 'GT',
    gtSubTeam: 'Generales',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → RRPP
  {
    id: 'fn_gt_rrpp_1',
    name: 'Recepción de invitados',
    category: 'GT',
    gtSubTeam: 'RRPP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_rrpp_2',
    name: 'Protocolo',
    category: 'GT',
    gtSubTeam: 'RRPP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_rrpp_3',
    name: 'Acompañamiento VIP',
    category: 'GT',
    gtSubTeam: 'RRPP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → GH
  {
    id: 'fn_gt_gh_1',
    name: 'Bienestar de staff',
    category: 'GT',
    gtSubTeam: 'GH',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_gh_2',
    name: 'Puntos de hidratación',
    category: 'GT',
    gtSubTeam: 'GH',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_gh_3',
    name: 'Registro de asistencia',
    category: 'GT',
    gtSubTeam: 'GH',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → Mercadeo
  {
    id: 'fn_gt_mkt_1',
    name: 'Registro fotográfico',
    category: 'GT',
    gtSubTeam: 'Mercadeo',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_mkt_2',
    name: 'Cobertura en vivo',
    category: 'GT',
    gtSubTeam: 'Mercadeo',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_mkt_3',
    name: 'Activación de marca',
    category: 'GT',
    gtSubTeam: 'Mercadeo',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → Seguridad
  {
    id: 'fn_gt_seg_1',
    name: 'Control de accesos',
    category: 'GT',
    gtSubTeam: 'Seguridad',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_seg_2',
    name: 'Vigilancia de zona',
    category: 'GT',
    gtSubTeam: 'Seguridad',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_seg_3',
    name: 'Punto de auxilio',
    category: 'GT',
    gtSubTeam: 'Seguridad',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → Carnival
  {
    id: 'fn_gt_car_1',
    name: 'Animación de atracciones',
    category: 'GT',
    gtSubTeam: 'Carnival',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_car_2',
    name: 'Apoyo técnico',
    category: 'GT',
    gtSubTeam: 'Carnival',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_car_3',
    name: 'Logística de juegos',
    category: 'GT',
    gtSubTeam: 'Carnival',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GT → The Games
  {
    id: 'fn_gt_gam_1',
    name: 'Juez de campo',
    category: 'GT',
    gtSubTeam: 'The Games',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_gam_2',
    name: 'Planillero',
    category: 'GT',
    gtSubTeam: 'The Games',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gt_gam_3',
    name: 'Control de tiempos',
    category: 'GT',
    gtSubTeam: 'The Games',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // GAP (funciones propias de GAP)
  {
    id: 'fn_gap_1',
    name: 'Orientación',
    category: 'GAP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gap_2',
    name: 'Acceso',
    category: 'GAP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gap_3',
    name: 'Control',
    category: 'GAP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gap_4',
    name: 'Animación de base',
    category: 'GAP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_gap_5',
    name: 'Seguridad de base',
    category: 'GAP',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },

  // MESA (funciones propias de Mesa)
  {
    id: 'fn_mesa_1',
    name: 'Coordinación',
    category: 'MESA',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_mesa_2',
    name: 'Supervisión',
    category: 'MESA',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_mesa_3',
    name: 'Apoyo directivo',
    category: 'MESA',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'fn_mesa_4',
    name: 'Resolución de incidencias',
    category: 'MESA',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

/**
 * Filter functions strictly by group hierarchy.
 * Never mixes GT subteams with each other or with GAP / MESA.
 */
export function getFilteredFunctions(
  functions: GroupFunction[],
  category: PersonType,
  gtSubTeam?: string,
  onlyActive = true
): GroupFunction[] {
  return functions.filter((f) => {
    if (onlyActive && !f.isActive) return false;
    if (f.category !== category) return false;

    if (category === 'GT') {
      if (!gtSubTeam) return true;
      return f.gtSubTeam === gtSubTeam;
    }

    return true;
  });
}
