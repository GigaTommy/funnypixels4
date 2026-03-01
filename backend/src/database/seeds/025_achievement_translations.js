/**
 * Seed achievement translations for supported languages.
 *
 * 修复记录:
 * - 2026-02-17: 改为通过 achievement key 动态查找 ID（不再硬编码 content_id）
 *   旧版硬编码 content_id 1-4 与实际数据库 ID 不匹配
 * - 覆盖 achievement_definitions 表中所有成就的翻译
 */

exports.seed = async function (knex) {
  const exists = await knex.schema.hasTable('content_translations');
  if (!exists) {
    console.log('content_translations table does not exist, skipping seed');
    return;
  }

  // 翻译数据，按 achievement key 索引（与 017_achievement_definitions_expanded.js 一致）
  const translationsByKey = {
    first_pixel: {
      'zh-Hans': { name: '第一个像素', description: '绘制你的第一个像素' },
      ja: { name: '最初のピクセル', description: '最初のピクセルを描く' },
      ko: { name: '첫 번째 픽셀', description: '첫 번째 픽셀 그리기' },
      es: { name: 'Primer Pixel', description: 'Dibuja tu primer pixel' },
      'pt-BR': { name: 'Primeiro Pixel', description: 'Desenhe seu primeiro pixel' },
    },
    pixel_artist_10: {
      'zh-Hans': { name: '像素艺术家', description: '绘制10个像素' },
      ja: { name: 'ピクセルアーティスト', description: '10ピクセルを描く' },
      ko: { name: '픽셀 아티스트', description: '10 픽셀 그리기' },
      es: { name: 'Artista de Pixeles', description: 'Dibuja 10 pixeles' },
      'pt-BR': { name: 'Artista de Pixels', description: 'Desenhe 10 pixels' },
    },
    pixel_master_50: {
      'zh-Hans': { name: '像素大师', description: '绘制50个像素' },
      ja: { name: 'ピクセルマスター', description: '50ピクセルを描く' },
      ko: { name: '픽셀 마스터', description: '50 픽셀 그리기' },
      es: { name: 'Maestro de Pixeles', description: 'Dibuja 50 pixeles' },
      'pt-BR': { name: 'Mestre em Pixels', description: 'Desenhe 50 pixels' },
    },
    pixel_expert_100: {
      'zh-Hans': { name: '像素专家', description: '绘制100个像素' },
      ja: { name: 'ピクセルエキスパート', description: '100ピクセルを描く' },
      ko: { name: '픽셀 전문가', description: '100 픽셀 그리기' },
      es: { name: 'Experto en Pixeles', description: 'Dibuja 100 pixeles' },
      'pt-BR': { name: 'Especialista em Pixels', description: 'Desenhe 100 pixels' },
    },
    pixel_legend_500: {
      'zh-Hans': { name: '像素传奇', description: '绘制500个像素' },
      ja: { name: 'ピクセルレジェンド', description: '500ピクセルを描く' },
      ko: { name: '픽셀 전설', description: '500 픽셀 그리기' },
      es: { name: 'Leyenda de Pixeles', description: 'Dibuja 500 pixeles' },
      'pt-BR': { name: 'Lenda em Pixels', description: 'Desenhe 500 pixels' },
    },
    pixel_god_1000: {
      'zh-Hans': { name: '像素之神', description: '绘制1000个像素' },
      ja: { name: 'ピクセルの神', description: '1000ピクセルを描く' },
      ko: { name: '픽셀의 신', description: '1000 픽셀 그리기' },
      es: { name: 'Dios de los Pixeles', description: 'Dibuja 1000 pixeles' },
      'pt-BR': { name: 'Deus dos Pixels', description: 'Desenhe 1000 pixels' },
    },
    gps_explorer: {
      'zh-Hans': { name: 'GPS探险家', description: '完成第一次GPS绘制会话' },
      ja: { name: 'GPS探検家', description: '初めてのGPS描画セッションを完了' },
      ko: { name: 'GPS 탐험가', description: '첫 GPS 그리기 세션 완료' },
      es: { name: 'Explorador GPS', description: 'Completa tu primera sesión de dibujo GPS' },
      'pt-BR': { name: 'Explorador GPS', description: 'Complete sua primeira sessão de desenho GPS' },
    },
    daily_visitor_7: {
      'zh-Hans': { name: '每日访客', description: '连续活跃7天' },
      ja: { name: 'デイリービジター', description: '7日間連続アクティブ' },
      ko: { name: '매일 방문자', description: '7일 연속 활동' },
      es: { name: 'Visitante Diario', description: 'Activo durante 7 días consecutivos' },
      'pt-BR': { name: 'Visitante Diário', description: 'Ativo por 7 dias consecutivos' },
    },
    dedicated_user_30: {
      'zh-Hans': { name: '忠实用户', description: '连续活跃30天' },
      ja: { name: '忠実なユーザー', description: '30日間連続アクティブ' },
      ko: { name: '충실한 사용자', description: '30일 연속 활동' },
      es: { name: 'Usuario Dedicado', description: 'Activo durante 30 días consecutivos' },
      'pt-BR': { name: 'Usuário Dedicado', description: 'Ativo por 30 dias consecutivos' },
    },
    team_player: {
      'zh-Hans': { name: '团队协作者', description: '为联盟贡献10次' },
      ja: { name: 'チームプレイヤー', description: 'アライアンスに10回貢献' },
      ko: { name: '팀 플레이어', description: '동맹에 10회 기여' },
      es: { name: 'Jugador de Equipo', description: 'Contribuye 10 veces a la alianza' },
      'pt-BR': { name: 'Jogador de Equipe', description: 'Contribua 10 vezes para a aliança' },
    },
    first_purchase: {
      'zh-Hans': { name: '首次购买', description: '在商店完成第一次购买' },
      ja: { name: '初めての購入', description: 'ショップで初めての購入を完了' },
      ko: { name: '첫 구매', description: '상점에서 첫 구매 완료' },
      es: { name: 'Primera Compra', description: 'Completa tu primera compra en la tienda' },
      'pt-BR': { name: 'Primeira Compra', description: 'Complete sua primeira compra na loja' },
    },
  };

  // content_translations.content_id 是 integer 类型
  // achievement_definitions.id 是 uuid 类型
  // 因此使用行号作为 content_id（按 key 字母序排列，从 1 开始）
  const definitions = await knex('achievement_definitions').select('id', 'key').orderBy('key');
  const keyToId = {};
  definitions.forEach((def, idx) => {
    keyToId[def.key] = idx + 1; // 使用序号 1, 2, 3... 作为 content_id
  });

  let count = 0;
  for (const [achievementKey, langs] of Object.entries(translationsByKey)) {
    const contentId = keyToId[achievementKey];
    if (!contentId) {
      console.log(`  ⚠️ achievement_definitions 中未找到 key="${achievementKey}", 跳过翻译`);
      continue;
    }

    for (const [langCode, fields] of Object.entries(langs)) {
      for (const [fieldName, value] of Object.entries(fields)) {
        const where = {
          content_type: 'achievement_definition',
          content_id: contentId,
          lang_code: langCode,
          field_name: fieldName,
        };

        const existing = await knex('content_translations').where(where).first();
        if (existing) {
          await knex('content_translations')
            .where({ id: existing.id })
            .update({ value, updated_at: knex.fn.now() });
        } else {
          await knex('content_translations').insert({ ...where, value });
        }
        count++;
      }
    }
  }

  console.log(`✅ achievement translations: ${count} 条翻译已同步`);
};
