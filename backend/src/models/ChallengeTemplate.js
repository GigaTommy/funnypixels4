const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ChallengeTemplate {
  static async getActiveTemplates() {
    return db('challenge_templates')
      .where('is_active', true)
      .orderBy('weight', 'desc');
  }

  static async findById(id) {
    return db('challenge_templates').where('id', id).first();
  }

  static async findAll(params = {}) {
    const { current = 1, pageSize = 20, type, difficulty, is_active, keyword } = params;

    let query = db('challenge_templates');

    if (type) query = query.where('type', type);
    if (difficulty) query = query.where('difficulty', difficulty);
    if (is_active !== undefined && is_active !== '') {
      query = query.where('is_active', is_active === 'true' || is_active === true);
    }
    if (keyword) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${keyword}%`)
          .orWhere('description', 'ilike', `%${keyword}%`);
      });
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const offset = (current - 1) * pageSize;
    const list = await query.clone().orderBy('created_at', 'desc').offset(offset).limit(pageSize);

    return { list, total, current: parseInt(current), pageSize: parseInt(pageSize) };
  }

  static async create(data) {
    const template = {
      id: uuidv4(),
      type: data.type,
      title: data.title,
      description: data.description,
      target_value: data.target_value,
      reward_points: data.reward_points || 20,
      reward_items: JSON.stringify(data.reward_items || []),
      weight: data.weight || 1,
      difficulty: data.difficulty || 'normal',
      is_active: data.is_active !== false,
      metadata: JSON.stringify(data.metadata || {}),
      created_at: new Date(),
      updated_at: new Date()
    };

    const [inserted] = await db('challenge_templates').insert(template).returning('*');
    return inserted;
  }

  static async update(id, data) {
    const updateData = { ...data, updated_at: new Date() };
    if (updateData.reward_items) updateData.reward_items = JSON.stringify(updateData.reward_items);
    if (updateData.metadata) updateData.metadata = JSON.stringify(updateData.metadata);

    const [updated] = await db('challenge_templates')
      .where('id', id)
      .update(updateData)
      .returning('*');
    return updated;
  }

  static async delete(id) {
    return db('challenge_templates').where('id', id).del();
  }

  static async toggleActive(id) {
    const template = await db('challenge_templates').where('id', id).first();
    if (!template) throw new Error('Template not found');

    const [updated] = await db('challenge_templates')
      .where('id', id)
      .update({ is_active: !template.is_active, updated_at: new Date() })
      .returning('*');
    return updated;
  }

  // Weighted random selection from active templates
  static async selectRandomTemplate() {
    const templates = await this.getActiveTemplates();
    if (templates.length === 0) return null;

    const totalWeight = templates.reduce((sum, t) => sum + (t.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const template of templates) {
      random -= (template.weight || 1);
      if (random <= 0) return template;
    }
    return templates[templates.length - 1];
  }
}

module.exports = ChallengeTemplate;
