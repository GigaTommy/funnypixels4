/**
 * BaseRepository 测试
 */

const BaseRepository = require('../../repositories/BaseRepository');
const { createMockDb } = require('../helpers/mockDb');

describe('BaseRepository', () => {
  let repository;
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    repository = new BaseRepository(mockDb, 'test_table');
  });

  describe('query()', () => {
    test('应该返回查询构建器', () => {
      const query = repository.query();
      expect(mockDb).toHaveBeenCalledWith('test_table');
    });
  });

  describe('findById()', () => {
    test('应该根据ID查找记录', async () => {
      const mockRecord = { id: 1, name: 'Test' };
      mockDb.mockResolvedValue(mockRecord);

      const result = await repository.findById(1);

      expect(mockDb).toHaveBeenCalledWith('test_table');
      expect(result).toEqual(mockRecord);
    });
  });

  describe('findOne()', () => {
    test('应该根据条件查找单个记录', async () => {
      const mockRecord = { id: 1, email: 'test@example.com' };
      mockDb.mockResolvedValue(mockRecord);

      const result = await repository.findOne({ email: 'test@example.com' });

      expect(result).toEqual(mockRecord);
    });
  });

  describe('findMany()', () => {
    test('应该根据条件查找多个记录', async () => {
      const mockRecords = [
        { id: 1, status: 'active' },
        { id: 2, status: 'active' }
      ];
      mockDb.mockResolvedValue(mockRecords);

      const result = await repository.findMany({ status: 'active' });

      expect(result).toEqual(mockRecords);
    });

    test('应该支持分页选项', async () => {
      const mockRecords = [{ id: 1 }, { id: 2 }];
      mockDb.mockResolvedValue(mockRecords);

      await repository.findMany({}, {
        limit: 10,
        offset: 20,
        orderBy: 'created_at',
        order: 'desc'
      });

      // 验证调用链
      expect(mockDb().where).toHaveBeenCalled();
      expect(mockDb().orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockDb().limit).toHaveBeenCalledWith(10);
      expect(mockDb().offset).toHaveBeenCalledWith(20);
    });

    test('应该支持多字段排序', async () => {
      const mockRecords = [];
      mockDb.mockResolvedValue(mockRecords);

      await repository.findMany({}, {
        orderBy: ['created_at', 'name']
      });

      expect(mockDb().orderBy).toHaveBeenCalledTimes(2);
    });
  });

  describe('create()', () => {
    test('应该创建记录', async () => {
      const mockRecord = { id: 1, name: 'Test', created_at: expect.any(Date) };
      mockDb().returning.mockResolvedValue([mockRecord]);

      const result = await repository.create({ name: 'Test' });

      expect(mockDb).toHaveBeenCalledWith('test_table');
      expect(mockDb().insert).toHaveBeenCalled();
      expect(result).toEqual(mockRecord);
    });

    test('应该自动添加时间戳', async () => {
      const mockRecord = { id: 1, name: 'Test' };
      mockDb().returning.mockResolvedValue([mockRecord]);

      await repository.create({ name: 'Test' });

      const insertData = mockDb().insert.mock.calls[0][0];
      expect(insertData.created_at).toBeInstanceOf(Date);
      expect(insertData.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('createMany()', () => {
    test('应该批量创建记录', async () => {
      const mockRecords = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ];
      mockDb().returning.mockResolvedValue(mockRecords);

      const result = await repository.createMany([
        { name: 'Test 1' },
        { name: 'Test 2' }
      ]);

      expect(result).toEqual(mockRecords);
      expect(mockDb().insert).toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    test('应该更新记录', async () => {
      const mockRecord = { id: 1, name: 'Updated', updated_at: expect.any(Date) };
      mockDb().returning.mockResolvedValue([mockRecord]);

      const result = await repository.update(1, { name: 'Updated' });

      expect(mockDb().where).toHaveBeenCalledWith({ id: 1 });
      expect(mockDb().update).toHaveBeenCalled();
      expect(result).toEqual(mockRecord);
    });

    test('应该自动更新 updated_at', async () => {
      mockDb().returning.mockResolvedValue([{ id: 1 }]);

      await repository.update(1, { name: 'Updated' });

      const updateData = mockDb().update.mock.calls[0][0];
      expect(updateData.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('delete()', () => {
    test('应该删除记录', async () => {
      mockDb().del.mockResolvedValue(1);

      const result = await repository.delete(1);

      expect(mockDb().where).toHaveBeenCalledWith({ id: 1 });
      expect(mockDb().del).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('exists()', () => {
    test('应该在记录存在时返回 true', async () => {
      mockDb.mockResolvedValue({ id: 1 });

      const result = await repository.exists({ email: 'test@example.com' });

      expect(result).toBe(true);
    });

    test('应该在记录不存在时返回 false', async () => {
      mockDb.mockResolvedValue(undefined);

      const result = await repository.exists({ email: 'nonexistent@example.com' });

      expect(result).toBe(false);
    });
  });

  describe('count()', () => {
    test('应该统计记录数量', async () => {
      mockDb().count.mockResolvedValue([{ count: '42' }]);

      const result = await repository.count({ status: 'active' });

      expect(mockDb().where).toHaveBeenCalledWith({ status: 'active' });
      expect(mockDb().count).toHaveBeenCalledWith('* as count');
      expect(result).toBe(42);
    });

    test('应该支持无条件统计', async () => {
      mockDb().count.mockResolvedValue([{ count: '100' }]);

      const result = await repository.count();

      expect(result).toBe(100);
    });
  });

  describe('paginate()', () => {
    test('应该返回分页结果', async () => {
      const mockRecords = [{ id: 1 }, { id: 2 }];
      const mockCount = [{ count: '42' }];

      // Mock findMany
      mockDb.mockResolvedValueOnce(mockRecords);
      // Mock count
      mockDb().count.mockResolvedValueOnce(mockCount);

      const result = await repository.paginate({ status: 'active' }, 2, 10);

      expect(result).toEqual({
        data: mockRecords,
        total: 42,
        page: 2,
        pageSize: 10,
        totalPages: 5
      });
    });

    test('应该计算正确的偏移量', async () => {
      mockDb.mockResolvedValue([]);
      mockDb().count.mockResolvedValue([{ count: '0' }]);

      await repository.paginate({}, 3, 10);

      // Page 3, pageSize 10 -> offset 20
      expect(mockDb().offset).toHaveBeenCalledWith(20);
      expect(mockDb().limit).toHaveBeenCalledWith(10);
    });
  });

  describe('transaction()', () => {
    test('应该执行事务', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      mockDb.transaction = jest.fn().mockImplementation(cb => cb());

      const result = await repository.transaction(mockCallback);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('raw()', () => {
    test('应该执行原始查询', async () => {
      const mockResult = { rows: [{ count: 1 }] };
      mockDb.raw = jest.fn().mockResolvedValue(mockResult);

      const result = await repository.raw('SELECT COUNT(*) FROM users WHERE id = ?', [1]);

      expect(mockDb.raw).toHaveBeenCalledWith('SELECT COUNT(*) FROM users WHERE id = ?', [1]);
      expect(result).toEqual(mockResult);
    });
  });
});
