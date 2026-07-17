// EXPORTS: ITeamMember, MOCK_TEAM_MEMBERS

// 班组人员结构，排班时会根据班组、角色和技能进行匹配。
export interface ITeamMember {
  id: string;
  name: string;
  team: 'A1' | 'A2' | 'A3' | 'B';
  shiftType: '早班/晚班' | '长白班';
  role: '组长' | '组员';
  skills: string[];
  imageUrl: string;
}

// 维护人员示例数据，覆盖 A1/A2/A3 轮班组和 B 长白班组。
export const MOCK_TEAM_MEMBERS: ITeamMember[] = [
  {
    id: '1',
    name: '张工',
    team: 'A1',
    shiftType: '早班/晚班',
    role: '组长',
    skills: ['电工', '注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/1.jpg',
  },
  {
    id: '2',
    name: '李工',
    team: 'A1',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['电工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/2.jpg',
  },
  {
    id: '3',
    name: '王工',
    team: 'A1',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/3.jpg',
  },
  {
    id: '4',
    name: '赵工',
    team: 'A1',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['钳工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/4.jpg',
  },
  {
    id: '5',
    name: '陈工',
    team: 'A2',
    shiftType: '早班/晚班',
    role: '组长',
    skills: ['注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/5.jpg',
  },
  {
    id: '6',
    name: '刘工',
    team: 'A2',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['电工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/6.jpg',
  },
  {
    id: '7',
    name: '周工',
    team: 'A2',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['钳工', '注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/7.jpg',
  },
  {
    id: '8',
    name: '吴工',
    team: 'A2',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['电工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/8.jpg',
  },
  {
    id: '9',
    name: '郑工',
    team: 'A3',
    shiftType: '早班/晚班',
    role: '组长',
    skills: ['钳工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/9.jpg',
  },
  {
    id: '10',
    name: '孙工',
    team: 'A3',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['电工', '注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/10.jpg',
  },
  {
    id: '11',
    name: '钱工',
    team: 'A3',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/11.jpg',
  },
  {
    id: '12',
    name: '马工',
    team: 'A3',
    shiftType: '早班/晚班',
    role: '组员',
    skills: ['电工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/1.jpg',
  },
  {
    id: '13',
    name: '黄工',
    team: 'B',
    shiftType: '长白班',
    role: '组长',
    skills: ['电工', '注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/2.jpg',
  },
  {
    id: '14',
    name: '朱工',
    team: 'B',
    shiftType: '长白班',
    role: '组员',
    skills: ['钳工'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/3.jpg',
  },
  {
    id: '15',
    name: '胡工',
    team: 'B',
    shiftType: '长白班',
    role: '组员',
    skills: ['注塑维修'],
    imageUrl: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ylcylz_fsph_ryhs/ljhwZthlaukjlkulzlp/feisuda/avatar/base/4.jpg',
  },
];
