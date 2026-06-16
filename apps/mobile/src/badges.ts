import { TopicCategory } from '@clearpass/core';

export type TopicBadge = {
  topic: string;
  topicCategory: TopicCategory;
  badgeName: string;
  description: string;
};

export const TOPIC_BADGES: TopicBadge[] = [
  {
    topic: 'Alertness',
    topicCategory: TopicCategory.Alertness,
    badgeName: 'Eagle Eye',
    description: 'Scored 80%+ on 20+ alertness questions',
  },
  {
    topic: 'Attitude',
    topicCategory: TopicCategory.Attitude,
    badgeName: 'Road Diplomat',
    description: 'Scored 80%+ on 20+ attitude questions',
  },
  {
    topic: 'Safety & Your Vehicle',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    badgeName: 'Vehicle Expert',
    description: 'Scored 80%+ on 20+ vehicle safety questions',
  },
  {
    topic: 'Safety Margins',
    topicCategory: TopicCategory.SafetyMargins,
    badgeName: 'Gap Master',
    description: 'Scored 80%+ on 20+ safety margin questions',
  },
  {
    topic: 'Hazard Awareness',
    topicCategory: TopicCategory.HazardAwareness,
    badgeName: 'Hazard Hunter',
    description: 'Scored 80%+ on 20+ hazard awareness questions',
  },
  {
    topic: 'Vulnerable Road Users',
    topicCategory: TopicCategory.VulnerableRoadUsers,
    badgeName: 'Guardian',
    description: 'Scored 80%+ on 20+ vulnerable road user questions',
  },
  {
    topic: 'Other Types of Vehicle',
    topicCategory: TopicCategory.OtherTypes,
    badgeName: 'Road Savvy',
    description: 'Scored 80%+ on 20+ other vehicle type questions',
  },
  {
    topic: 'Vehicle Handling',
    topicCategory: TopicCategory.VehicleHandling,
    badgeName: 'Smooth Driver',
    description: 'Scored 80%+ on 20+ vehicle handling questions',
  },
  {
    topic: 'Motorway Rules',
    topicCategory: TopicCategory.MotorwayRules,
    badgeName: 'Motorway Pro',
    description: 'Scored 80%+ on 20+ motorway rules questions',
  },
  {
    topic: 'Rules of the Road',
    topicCategory: TopicCategory.RulesOfTheRoad,
    badgeName: 'Highway Scholar',
    description: 'Scored 80%+ on 20+ road rules questions',
  },
  {
    topic: 'Road & Traffic Signs',
    topicCategory: TopicCategory.RoadAndTrafficSigns,
    badgeName: 'Sign Reader',
    description: 'Scored 80%+ on 20+ road sign questions',
  },
  {
    topic: 'Documents & Regulations',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    badgeName: 'Paper Trail',
    description: 'Scored 80%+ on 20+ document questions',
  },
  {
    topic: 'Accidents & Emergencies',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    badgeName: 'First Responder',
    description: 'Scored 80%+ on 20+ accident & emergency questions',
  },
  {
    topic: 'Vehicle Loading',
    topicCategory: TopicCategory.VehicleLoading,
    badgeName: 'Load Master',
    description: 'Scored 80%+ on 20+ vehicle loading questions',
  },
];
