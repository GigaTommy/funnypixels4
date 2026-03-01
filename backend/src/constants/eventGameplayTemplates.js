/**
 * P0-2: 活动玩法模板库
 * 为不同类型的活动提供预设的玩法说明
 */

const GAMEPLAY_TEMPLATES = {
    territory_control: {
        objective: {
            en: "Capture and hold the most territory by drawing continuous pixels",
            zh: "通过绘制连续的像素占领并保持最多的领地",
            ja: "連続したピクセルを描くことで最も多くの領土を獲得し保持する"
        },
        scoringRules: {
            en: [
                "Each pixel contributes points based on how long it's held",
                "Continuous same-color pixels form territories",
                "Larger territories accumulate points faster",
                "Pixels can be overwritten by other alliances"
            ],
            zh: [
                "每个像素根据持有时长累计积分",
                "连续的同色像素形成领地",
                "领地越大,积分增长越快",
                "像素可能被其他联盟覆盖"
            ],
            ja: [
                "各ピクセルは保持時間に基づいてポイントを獲得",
                "連続した同色ピクセルが領土を形成",
                "領土が大きいほどポイントが速く蓄積",
                "ピクセルは他の同盟に上書きされる可能性がある"
            ]
        },
        tips: {
            en: [
                "Focus on central areas for better defense",
                "Coordinate with teammates to draw continuous areas",
                "Regularly patrol to defend against overwrites",
                "Build buffer zones around key territories"
            ],
            zh: [
                "优先占领中心区域便于防守",
                "与队友协调绘制连续区域",
                "定期巡查防止被覆盖",
                "在关键领地周围建立缓冲区"
            ],
            ja: [
                "防御しやすい中心エリアに集中",
                "チームメイトと協力して連続エリアを描く",
                "定期的にパトロールして上書きを防ぐ",
                "重要な領土の周りにバッファゾーンを構築"
            ]
        },
        // P2-2: Enhanced difficulty rating
        difficulty: {
            level: 3, // 1-5 stars
            factors: {
                competition: 4, // 1-5 scale
                timeCommitment: 3,
                skillRequired: 3
            },
            estimatedTimePerDay: 150, // minutes
            recommendedFor: ["alliances", "active_players"]
        }
    },

    leaderboard: {
        objective: {
            en: "Draw the most pixels within the event area to top the leaderboard",
            zh: "在活动区域内绘制最多像素以登顶排行榜",
            ja: "イベントエリア内で最も多くのピクセルを描いてリーダーボードのトップに"
        },
        scoringRules: {
            en: [
                "Each pixel drawn counts as 1 point",
                "Only pixels within event boundaries count",
                "Overwriting your own pixels doesn't add points",
                "Alliance scores = sum of all member pixels"
            ],
            zh: [
                "每个绘制的像素计1分",
                "只有活动边界内的像素计分",
                "覆盖自己的像素不增加分数",
                "联盟积分 = 所有成员像素之和"
            ],
            ja: [
                "描いたピクセルごとに1ポイント",
                "イベント境界内のピクセルのみカウント",
                "自分のピクセルを上書きしてもポイントは追加されない",
                "同盟スコア = 全メンバーのピクセルの合計"
            ]
        },
        tips: {
            en: [
                "Focus on quantity over quality",
                "Fill large areas efficiently",
                "Avoid redrawing same pixels",
                "Mobilize all alliance members"
            ],
            zh: [
                "注重数量而非质量",
                "高效填充大片区域",
                "避免重复绘制相同像素",
                "动员所有联盟成员"
            ],
            ja: [
                "質より量に集中",
                "大きなエリアを効率的に塗りつぶす",
                "同じピクセルの再描画を避ける",
                "すべての同盟メンバーを動員"
            ]
        },
        // P2-2: Enhanced difficulty rating
        difficulty: {
            level: 2, // 1-5 stars
            factors: {
                competition: 2,
                timeCommitment: 2,
                skillRequired: 1
            },
            estimatedTimePerDay: 90, // minutes
            recommendedFor: ["beginners", "casual_players", "alliances"]
        }
    },

    war: {
        objective: {
            en: "Eliminate enemy pixels and defend your alliance's territory",
            zh: "消灭敌方像素并防守己方联盟领地",
            ja: "敵のピクセルを排除し、同盟の領土を守る"
        },
        scoringRules: {
            en: [
                "Overwriting enemy pixels: +2 points",
                "Defending pixels (not overwritten): +1 point/hour",
                "Losing pixels to enemies: -1 point",
                "Strategic locations give bonus points"
            ],
            zh: [
                "覆盖敌方像素: +2分",
                "防守像素(未被覆盖): +1分/小时",
                "像素被敌方覆盖: -1分",
                "战略要地给予额外加分"
            ],
            ja: [
                "敵ピクセルの上書き: +2ポイント",
                "ピクセルの防御(上書きされない): +1ポイント/時",
                "敵にピクセルを奪われる: -1ポイント",
                "戦略的な場所はボーナスポイント"
            ]
        },
        tips: {
            en: [
                "Identify weak points in enemy defenses",
                "Launch coordinated attacks at key times",
                "Maintain defensive rotations",
                "Use guerrilla tactics in enemy territory"
            ],
            zh: [
                "识别敌方防守薄弱点",
                "在关键时刻发起协同攻击",
                "保持防守轮换",
                "在敌方领地使用游击战术"
            ],
            ja: [
                "敵の防御の弱点を特定",
                "重要な時に協調攻撃を開始",
                "防御ローテーションを維持",
                "敵領土でゲリラ戦術を使用"
            ]
        },
        // P2-2: Enhanced difficulty rating
        difficulty: {
            level: 5, // 1-5 stars
            factors: {
                competition: 5,
                timeCommitment: 4,
                skillRequired: 4
            },
            estimatedTimePerDay: 210, // minutes
            recommendedFor: ["experienced_players", "competitive_alliances"]
        }
    },

    cooperation: {
        objective: {
            en: "Work together with all participants to complete a collaborative artwork",
            zh: "与所有参与者合作完成协作画作",
            ja: "すべての参加者と協力して共同アートワークを完成させる"
        },
        scoringRules: {
            en: [
                "Individual contribution score based on pixels placed",
                "Bonus for placing pixels in designated areas",
                "Team completion bonus when artwork reaches milestones",
                "Perfect placement bonus (matching template)"
            ],
            zh: [
                "个人贡献分基于放置的像素",
                "在指定区域放置像素获得奖励",
                "画作达到里程碑时团队完成奖励",
                "完美放置奖励(匹配模板)"
            ],
            ja: [
                "配置されたピクセルに基づく個人貢献スコア",
                "指定エリアにピクセルを配置するとボーナス",
                "アートワークがマイルストーンに達するとチーム完成ボーナス",
                "完璧な配置ボーナス(テンプレートに一致)"
            ]
        },
        tips: {
            en: [
                "Follow the template guide",
                "Fill uncompleted areas first",
                "Coordinate to avoid duplication",
                "Help correct mistakes"
            ],
            zh: [
                "遵循模板指南",
                "优先填充未完成区域",
                "协调避免重复劳动",
                "帮助纠正错误"
            ],
            ja: [
                "テンプレートガイドに従う",
                "未完成エリアを最初に埋める",
                "重複を避けるために調整",
                "間違いを修正するのを手伝う"
            ]
        },
        // P2-2: Enhanced difficulty rating
        difficulty: {
            level: 1, // 1-5 stars
            factors: {
                competition: 1,
                timeCommitment: 2,
                skillRequired: 2
            },
            estimatedTimePerDay: 75, // minutes
            recommendedFor: ["beginners", "casual_players", "artists"]
        }
    }
};

module.exports = GAMEPLAY_TEMPLATES;
