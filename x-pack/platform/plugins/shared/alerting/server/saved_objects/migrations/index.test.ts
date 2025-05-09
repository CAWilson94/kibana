/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { getMigrations } from '.';
import type { RawRule, RawRuleAction } from '../../types';
import type { SavedObjectMigrationContext, SavedObjectUnsanitizedDoc } from '@kbn/core/server';
import { encryptedSavedObjectsMock } from '@kbn/encrypted-saved-objects-plugin/server/mocks';
import { migrationMocks } from '@kbn/core/server/mocks';
import { SavedObjectsUtils } from '@kbn/core-saved-objects-utils-server';
import type { RuleType } from '@kbn/securitysolution-rules';
import { ruleTypeMappings } from '@kbn/securitysolution-rules';
import { isAnyActionSupportIncidents } from './7.11';
import { RULE_SAVED_OBJECT_TYPE } from '..';

const migrationContext = migrationMocks.createContext();
const encryptedSavedObjectsSetup = encryptedSavedObjectsMock.createSetup();

const isPreconfigured = jest.fn();

describe('successful migrations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    encryptedSavedObjectsSetup.createMigration.mockImplementation(({ migration }) => migration);
  });

  describe('7.10.0', () => {
    test('marks alerts as legacy', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({});
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          meta: {
            versionApiKeyLastmodified: 'pre-7.10.0',
          },
        },
      });
    });

    test('migrates the consumer for metrics', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        consumer: 'metrics',
      });
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          consumer: 'infrastructure',
          meta: {
            versionApiKeyLastmodified: 'pre-7.10.0',
          },
        },
      });
    });

    test('migrates the consumer for siem', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        consumer: 'securitySolution',
      });
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          consumer: 'siem',
          meta: {
            versionApiKeyLastmodified: 'pre-7.10.0',
          },
        },
      });
    });

    test('migrates the consumer for alerting', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        consumer: 'alerting',
      });
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          consumer: 'alerts',
          meta: {
            versionApiKeyLastmodified: 'pre-7.10.0',
          },
        },
      });
    });

    test('migrates PagerDuty actions to set a default dedupkey of the AlertId', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.pagerduty',
            group: 'default',
            params: {
              summary: 'fired {{alertInstanceId}}',
              eventAction: 'resolve',
              component: '',
            },
            id: 'b62ea790-5366-4abc-a7df-33db1db78410',
          },
        ],
      });
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [
            {
              actionTypeId: '.pagerduty',
              group: 'default',
              params: {
                summary: 'fired {{alertInstanceId}}',
                eventAction: 'resolve',
                dedupKey: '{{alertId}}',
                component: '',
              },
              id: 'b62ea790-5366-4abc-a7df-33db1db78410',
            },
          ],
        },
      });
    });

    test('skips PagerDuty actions with a specified dedupkey', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.pagerduty',
            group: 'default',
            params: {
              summary: 'fired {{alertInstanceId}}',
              eventAction: 'trigger',
              dedupKey: '{{alertInstanceId}}',
              component: '',
            },
            id: 'b62ea790-5366-4abc-a7df-33db1db78410',
          },
        ],
      });
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [
            {
              actionTypeId: '.pagerduty',
              group: 'default',
              params: {
                summary: 'fired {{alertInstanceId}}',
                eventAction: 'trigger',
                dedupKey: '{{alertInstanceId}}',
                component: '',
              },
              id: 'b62ea790-5366-4abc-a7df-33db1db78410',
            },
          ],
        },
      });
    });

    test('skips PagerDuty actions with an eventAction of "trigger"', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.pagerduty',
            group: 'default',
            params: {
              summary: 'fired {{alertInstanceId}}',
              eventAction: 'trigger',
              component: '',
            },
            id: 'b62ea790-5366-4abc-a7df-33db1db78410',
          },
        ],
      });
      expect(migration710(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          meta: {
            versionApiKeyLastmodified: 'pre-7.10.0',
          },
          actions: [
            {
              actionTypeId: '.pagerduty',
              group: 'default',
              params: {
                summary: 'fired {{alertInstanceId}}',
                eventAction: 'trigger',
                component: '',
              },
              id: 'b62ea790-5366-4abc-a7df-33db1db78410',
            },
          ],
        },
      });
    });

    test('creates execution status', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData();
      const dateStart = Date.now();
      const migratedAlert = migration710(alert, migrationContext);
      const dateStop = Date.now();
      const dateExecutionStatus = Date.parse(
        migratedAlert.attributes.executionStatus.lastExecutionDate
      );

      expect(dateStart).toBeLessThanOrEqual(dateExecutionStatus);
      expect(dateStop).toBeGreaterThanOrEqual(dateExecutionStatus);

      expect(migratedAlert).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          executionStatus: {
            lastExecutionDate: migratedAlert.attributes.executionStatus.lastExecutionDate,
            status: 'pending',
            error: null,
          },
        },
      });
    });
  });

  describe('7.11.0', () => {
    test('add updatedAt field to alert - set to SavedObject updated_at attribute', () => {
      const migration711 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.0']
      );
      const alert = getMockData({}, true);
      expect(migration711(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          updatedAt: alert.updated_at,
          notifyWhen: 'onActiveAlert',
        },
      });
    });

    test('add updatedAt field to alert - set to createdAt when SavedObject updated_at is not defined', () => {
      const migration711 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.0']
      );
      const alert = getMockData({});
      expect(migration711(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          updatedAt: alert.attributes.createdAt,
          notifyWhen: 'onActiveAlert',
        },
      });
    });

    test('add notifyWhen=onActiveAlert when throttle is null', () => {
      const migration711 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.0']
      );
      const alert = getMockData({});
      expect(migration711(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          updatedAt: alert.attributes.createdAt,
          notifyWhen: 'onActiveAlert',
        },
      });
    });

    test('add notifyWhen=onActiveAlert when throttle is set', () => {
      const migration711 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.0']
      );
      const alert = getMockData({ throttle: '5m' });
      expect(migration711(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          updatedAt: alert.attributes.createdAt,
          notifyWhen: 'onThrottleInterval',
        },
      });
    });
  });

  describe('7.11.2', () => {
    test('transforms connectors that support incident correctly', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.jira',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                title: 'Jira summary',
                issueType: '10001',
                comments: [
                  {
                    commentId: '1',
                    comment: 'jira comment',
                  },
                ],
                description: 'Jira description',
                savedObjectId: '{{alertId}}',
                priority: 'Highest',
                parent: 'CASES-78',
                labels: ['test'],
              },
            },
            id: 'b1abe42d-ae1a-4a6a-b5ec-482ce0492c14',
          },
          {
            actionTypeId: '.resilient',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                savedObjectId: '{{alertId}}',
                incidentTypes: ['17', '21'],
                severityCode: '5',
                title: 'IBM name',
                description: 'IBM description',
                comments: [
                  {
                    commentId: 'alert-comment',
                    comment: 'IBM comment',
                  },
                ],
              },
            },
            id: '75d63268-9a83-460f-9026-0028f4f7dac4',
          },
          {
            actionTypeId: '.servicenow',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                severity: '2',
                impact: '2',
                urgency: '2',
                savedObjectId: '{{alertId}}',
                title: 'SN short desc',
                description: 'SN desc',
                comment: 'sn comment',
              },
            },
            id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
          },
        ],
      });

      expect(migration7112(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [
            {
              actionTypeId: '.jira',
              group: 'threshold met',
              params: {
                subAction: 'pushToService',
                subActionParams: {
                  incident: {
                    summary: 'Jira summary',
                    description: 'Jira description',
                    issueType: '10001',
                    priority: 'Highest',
                    parent: 'CASES-78',
                    labels: ['test'],
                  },
                  comments: [
                    {
                      commentId: '1',
                      comment: 'jira comment',
                    },
                  ],
                },
              },
              id: 'b1abe42d-ae1a-4a6a-b5ec-482ce0492c14',
            },
            {
              actionTypeId: '.resilient',
              group: 'threshold met',
              params: {
                subAction: 'pushToService',
                subActionParams: {
                  incident: {
                    name: 'IBM name',
                    description: 'IBM description',
                    incidentTypes: ['17', '21'],
                    severityCode: '5',
                  },
                  comments: [
                    {
                      commentId: 'alert-comment',
                      comment: 'IBM comment',
                    },
                  ],
                },
              },
              id: '75d63268-9a83-460f-9026-0028f4f7dac4',
            },
            {
              actionTypeId: '.servicenow',
              group: 'threshold met',
              params: {
                subAction: 'pushToService',
                subActionParams: {
                  incident: {
                    short_description: 'SN short desc',
                    description: 'SN desc',
                    severity: '2',
                    impact: '2',
                    urgency: '2',
                  },
                  comments: [{ commentId: '1', comment: 'sn comment' }],
                },
              },
              id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
            },
          ],
        },
      });
    });

    test('it transforms only subAction=pushToService', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.jira',
            group: 'threshold met',
            params: {
              subAction: 'issues',
              subActionParams: { issues: 'Task' },
            },
            id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
          },
        ],
      });

      expect(migration7112(alert, migrationContext)).toEqual(alert);
    });

    test('it does not transforms other connectors', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.server-log',
            group: 'threshold met',
            params: {
              level: 'info',
              message: 'log message',
            },
            id: '99257478-e591-4560-b264-441bdd4fe1d9',
          },
          {
            actionTypeId: '.servicenow',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                severity: '2',
                impact: '2',
                urgency: '2',
                savedObjectId: '{{alertId}}',
                title: 'SN short desc',
                description: 'SN desc',
                comment: 'sn comment',
              },
            },
            id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
          },
        ],
      });

      expect(migration7112(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [
            alert.attributes.actions![0],
            {
              actionTypeId: '.servicenow',
              group: 'threshold met',
              params: {
                subAction: 'pushToService',
                subActionParams: {
                  incident: {
                    short_description: 'SN short desc',
                    description: 'SN desc',
                    severity: '2',
                    impact: '2',
                    urgency: '2',
                  },
                  comments: [{ commentId: '1', comment: 'sn comment' }],
                },
              },
              id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
            },
          ],
        },
      });
    });

    test.each(['.jira', '.servicenow', '.resilient'])(
      'isAnyActionSupportIncidents should return true when %s is in actions',
      (actionTypeId) => {
        const doc = {
          attributes: { actions: [{ actionTypeId }, { actionTypeId: '.server-log' }] },
        } as SavedObjectUnsanitizedDoc<RawRule>;
        expect(isAnyActionSupportIncidents(doc)).toBe(true);
      }
    );

    test('isAnyActionSupportIncidents should return false when there is no connector that supports incidents', () => {
      const doc = {
        attributes: { actions: [{ actionTypeId: '.server-log' }] },
      } as SavedObjectUnsanitizedDoc<RawRule>;
      expect(isAnyActionSupportIncidents(doc)).toBe(false);
    });

    test('it does not transforms alerts when the right structure connectors is already applied', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.server-log',
            group: 'threshold met',
            params: {
              level: 'info',
              message: 'log message',
            },
            id: '99257478-e591-4560-b264-441bdd4fe1d9',
          },
          {
            actionTypeId: '.servicenow',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                incident: {
                  short_description: 'SN short desc',
                  description: 'SN desc',
                  severity: '2',
                  impact: '2',
                  urgency: '2',
                },
                comments: [{ commentId: '1', comment: 'sn comment' }],
              },
            },
            id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
          },
        ],
      });

      expect(migration7112(alert, migrationContext)).toEqual(alert);
    });

    test('if incident attribute is an empty object, copy back the related attributes from subActionParams back to incident', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.server-log',
            group: 'threshold met',
            params: {
              level: 'info',
              message: 'log message',
            },
            id: '99257478-e591-4560-b264-441bdd4fe1d9',
          },
          {
            actionTypeId: '.servicenow',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                short_description: 'SN short desc',
                description: 'SN desc',
                severity: '2',
                impact: '2',
                urgency: '2',
                incident: {},
                comments: [{ commentId: '1', comment: 'sn comment' }],
              },
            },
            id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
          },
        ],
      });

      expect(migration7112(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [
            alert.attributes.actions![0],
            {
              actionTypeId: '.servicenow',
              group: 'threshold met',
              params: {
                subAction: 'pushToService',
                subActionParams: {
                  incident: {
                    short_description: 'SN short desc',
                    description: 'SN desc',
                    severity: '2',
                    impact: '2',
                    urgency: '2',
                  },
                  comments: [{ commentId: '1', comment: 'sn comment' }],
                },
              },
              id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
            },
          ],
        },
      });
    });

    test('custom action does not get migrated/loss', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        actions: [
          {
            actionTypeId: '.mike',
            group: 'threshold met',
            params: {
              subAction: 'pushToService',
              subActionParams: {
                short_description: 'SN short desc',
                description: 'SN desc',
                severity: '2',
                impact: '2',
                urgency: '2',
                incident: {},
                comments: [{ commentId: '1', comment: 'sn comment' }],
              },
            },
            id: '1266562a-4e1f-4305-99ca-1b44c469b26e',
          },
        ],
      });

      expect(migration7112(alert, migrationContext)).toEqual(alert);
    });
  });

  describe('7.13.0', () => {
    test('security solution alerts get migrated and remove null values', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          author: ['Elastic'],
          buildingBlockType: null,
          description:
            "This rule detects a known command and control pattern in network events. The FIN7 threat group is known to use this command and control technique, while maintaining persistence in their target's network.",
          ruleId: '4a4e23cf-78a2-449c-bac3-701924c269d3',
          index: ['packetbeat-*'],
          falsePositives: [
            "This rule could identify benign domains that are formatted similarly to FIN7's command and control algorithm. Alerts should be investigated by an analyst to assess the validity of the individual observations.",
          ],
          from: 'now-6m',
          immutable: true,
          query:
            'event.category:(network OR network_traffic) AND type:(tls OR http) AND network.transport:tcp AND destination.domain:/[a-zA-Z]{4,5}.(pw|us|club|info|site|top)/ AND NOT destination.domain:zoom.us',
          language: 'lucene',
          license: 'Elastic License',
          outputIndex: '.siem-signals-rylandherrick_2-default',
          savedId: null,
          timelineId: null,
          timelineTitle: null,
          meta: null,
          filters: null,
          maxSignals: 100,
          riskScore: 73,
          riskScoreMapping: [],
          ruleNameOverride: null,
          severity: 'high',
          severityMapping: null,
          threat: null,
          threatFilters: null,
          timestampOverride: null,
          to: 'now',
          type: 'query',
          references: [
            'https://www.fireeye.com/blog/threat-research/2018/08/fin7-pursuing-an-enigmatic-and-evasive-global-criminal-operation.html',
          ],
          note: 'In the event this rule identifies benign domains in your environment, the `destination.domain` field in the rule can be modified to include those domains. Example: `...AND NOT destination.domain:(zoom.us OR benign.domain1 OR benign.domain2)`.',
          version: 1,
          exceptionsList: null,
          threshold: {
            field: null,
            value: 5,
          },
        },
      });

      expect(migration713(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            author: ['Elastic'],
            description:
              "This rule detects a known command and control pattern in network events. The FIN7 threat group is known to use this command and control technique, while maintaining persistence in their target's network.",
            ruleId: '4a4e23cf-78a2-449c-bac3-701924c269d3',
            index: ['packetbeat-*'],
            falsePositives: [
              "This rule could identify benign domains that are formatted similarly to FIN7's command and control algorithm. Alerts should be investigated by an analyst to assess the validity of the individual observations.",
            ],
            from: 'now-6m',
            immutable: true,
            query:
              'event.category:(network OR network_traffic) AND type:(tls OR http) AND network.transport:tcp AND destination.domain:/[a-zA-Z]{4,5}.(pw|us|club|info|site|top)/ AND NOT destination.domain:zoom.us',
            language: 'lucene',
            license: 'Elastic License',
            outputIndex: '.siem-signals-rylandherrick_2-default',
            maxSignals: 100,
            riskScore: 73,
            riskScoreMapping: [],
            severity: 'high',
            severityMapping: [],
            threat: [],
            to: 'now',
            type: 'query',
            references: [
              'https://www.fireeye.com/blog/threat-research/2018/08/fin7-pursuing-an-enigmatic-and-evasive-global-criminal-operation.html',
            ],
            note: 'In the event this rule identifies benign domains in your environment, the `destination.domain` field in the rule can be modified to include those domains. Example: `...AND NOT destination.domain:(zoom.us OR benign.domain1 OR benign.domain2)`.',
            version: 1,
            exceptionsList: [],
            threshold: {
              field: [],
              value: 5,
              cardinality: [],
            },
          },
        },
      });
    });

    test('non-null values in security solution alerts are not modified', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          author: ['Elastic'],
          buildingBlockType: 'default',
          description:
            "This rule detects a known command and control pattern in network events. The FIN7 threat group is known to use this command and control technique, while maintaining persistence in their target's network.",
          ruleId: '4a4e23cf-78a2-449c-bac3-701924c269d3',
          index: ['packetbeat-*'],
          falsePositives: [
            "This rule could identify benign domains that are formatted similarly to FIN7's command and control algorithm. Alerts should be investigated by an analyst to assess the validity of the individual observations.",
          ],
          from: 'now-6m',
          immutable: true,
          query:
            'event.category:(network OR network_traffic) AND type:(tls OR http) AND network.transport:tcp AND destination.domain:/[a-zA-Z]{4,5}.(pw|us|club|info|site|top)/ AND NOT destination.domain:zoom.us',
          language: 'lucene',
          license: 'Elastic License',
          outputIndex: '.siem-signals-rylandherrick_2-default',
          savedId: 'saved-id',
          timelineId: 'timeline-id',
          timelineTitle: 'timeline-title',
          meta: {
            field: 'value',
          },
          filters: ['filters'],
          maxSignals: 100,
          riskScore: 73,
          riskScoreMapping: ['risk-score-mapping'],
          ruleNameOverride: 'field.name',
          severity: 'high',
          severityMapping: ['severity-mapping'],
          threat: [
            {
              framework: 'MITRE ATT&CK',
              tactic: {
                id: 'TA0011',
                name: 'Command and Control',
                reference: 'https://attack.mitre.org/tactics/TA0011/',
              },
              technique: [
                {
                  id: 'T1483',
                  name: 'Domain Generation Algorithms',
                  reference: 'https://attack.mitre.org/techniques/T1483/',
                },
              ],
            },
          ],
          threatFilters: ['threat-filter'],
          timestampOverride: 'event.ingested',
          to: 'now',
          type: 'query',
          references: [
            'https://www.fireeye.com/blog/threat-research/2018/08/fin7-pursuing-an-enigmatic-and-evasive-global-criminal-operation.html',
          ],
          note: 'In the event this rule identifies benign domains in your environment, the `destination.domain` field in the rule can be modified to include those domains. Example: `...AND NOT destination.domain:(zoom.us OR benign.domain1 OR benign.domain2)`.',
          version: 1,
          exceptionsList: ['exceptions-list'],
        },
      });

      expect(migration713(alert, migrationContext)).toEqual(alert);
    });

    test('security solution threshold alert with string in threshold.field is migrated to array', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          threshold: {
            field: 'host.id',
            value: 5,
          },
        },
      });

      expect(migration713(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            threshold: {
              field: ['host.id'],
              value: 5,
              cardinality: [],
            },
            exceptionsList: [],
            riskScoreMapping: [],
            severityMapping: [],
            threat: [],
          },
        },
      });
    });

    test('security solution threshold alert with empty string in threshold.field is migrated to empty array', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          threshold: {
            field: '',
            value: 5,
          },
        },
      });

      expect(migration713(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            threshold: {
              field: [],
              value: 5,
              cardinality: [],
            },
            exceptionsList: [],
            riskScoreMapping: [],
            severityMapping: [],
            threat: [],
          },
        },
      });
    });

    test('security solution threshold alert with array in threshold.field and cardinality is left alone', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          threshold: {
            field: ['host.id'],
            value: 5,
            cardinality: [
              {
                field: 'source.ip',
                value: 10,
              },
            ],
          },
        },
      });

      expect(migration713(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            threshold: {
              field: ['host.id'],
              value: 5,
              cardinality: [
                {
                  field: 'source.ip',
                  value: 10,
                },
              ],
            },
            exceptionsList: [],
            riskScoreMapping: [],
            severityMapping: [],
            threat: [],
          },
        },
      });
    });

    test('security solution ML alert with string in machineLearningJobId is converted to an array', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          anomalyThreshold: 20,
          machineLearningJobId: 'my_job_id',
        },
      });

      expect(migration713(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            anomalyThreshold: 20,
            machineLearningJobId: ['my_job_id'],
            exceptionsList: [],
            riskScoreMapping: [],
            severityMapping: [],
            threat: [],
          },
        },
      });
    });

    test('security solution ML alert with an array in machineLearningJobId is preserved', () => {
      const migration713 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          anomalyThreshold: 20,
          machineLearningJobId: ['my_job_id', 'my_other_job_id'],
        },
      });

      expect(migration713(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            anomalyThreshold: 20,
            machineLearningJobId: ['my_job_id', 'my_other_job_id'],
            exceptionsList: [],
            riskScoreMapping: [],
            severityMapping: [],
            threat: [],
          },
        },
      });
    });
  });

  describe('7.14.1', () => {
    test('security solution author field is migrated to array if it is undefined', () => {
      const migration7141 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.14.1']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {},
      });

      expect(migration7141(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            author: [],
          },
        },
      });
    });

    test('security solution author field does not override existing values if they exist', () => {
      const migration7141 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.14.1']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          note: 'some note',
          author: ['author 1'],
        },
      });

      expect(migration7141(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          params: {
            note: 'some note',
            author: ['author 1'],
          },
        },
      });
    });
  });

  describe('7.15.0', () => {
    test('security solution is migrated to saved object references if it has 1 exceptionsList', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          note: 'some note', // extra data to ensure we do not overwrite other params
          exceptionsList: [
            {
              id: '123',
              list_id: '456',
              type: 'detection',
              namespace_type: 'single',
            },
          ],
        },
      });

      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution is migrated to saved object references if it has 2 exceptionsLists', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          note: 'some note', // extra data to ensure we do not overwrite other params
          exceptionsList: [
            {
              id: '123',
              list_id: '456',
              type: 'detection',
              namespace_type: 'agnostic',
            },
            {
              id: '789',
              list_id: '0123',
              type: 'detection',
              namespace_type: 'single',
            },
          ],
        },
      });

      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list-agnostic',
          },
          {
            name: 'param:exceptionsList_1',
            id: '789',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution is migrated to saved object references if it has 3 exceptionsLists', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          note: 'some note', // extra data to ensure we do not overwrite other params
          exceptionsList: [
            {
              id: '123',
              list_id: '456',
              type: 'detection',
              namespace_type: 'single',
            },
            {
              id: '789',
              list_id: '0123',
              type: 'detection',
              namespace_type: 'agnostic',
            },
            {
              id: '101112',
              list_id: '777',
              type: 'detection',
              namespace_type: 'single',
            },
          ],
        },
      });

      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
          {
            name: 'param:exceptionsList_1',
            id: '789',
            type: 'exception-list-agnostic',
          },
          {
            name: 'param:exceptionsList_2',
            id: '101112',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution does not change anything if exceptionsList is missing', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.signals',
        params: {
          note: 'some note',
        },
      });

      expect(migration7150(alert, migrationContext)).toEqual(alert);
    });

    test('security solution will keep existing references if we do not have an exceptionsList but we do already have references', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
          },
        }),
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
        ],
      };

      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution keep any foreign references if they exist but still migrate other references', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
            exceptionsList: [
              {
                id: '123',
                list_id: '456',
                type: 'detection',
                namespace_type: 'single',
              },
              {
                id: '789',
                list_id: '0123',
                type: 'detection',
                namespace_type: 'single',
              },
              {
                id: '101112',
                list_id: '777',
                type: 'detection',
                namespace_type: 'single',
              },
            ],
          },
        }),
        references: [
          {
            name: 'foreign-name',
            id: '999',
            type: 'foreign-name',
          },
        ],
      };

      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'foreign-name',
            id: '999',
            type: 'foreign-name',
          },
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
          {
            name: 'param:exceptionsList_1',
            id: '789',
            type: 'exception-list',
          },
          {
            name: 'param:exceptionsList_2',
            id: '101112',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution is idempotent and if re-run on the same migrated data will keep the same items', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
            exceptionsList: [
              {
                id: '123',
                list_id: '456',
                type: 'detection',
                namespace_type: 'single',
              },
              {
                id: '789',
                list_id: '0123',
                type: 'detection',
                namespace_type: 'single',
              },
            ],
          },
        }),
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
          {
            name: 'param:exceptionsList_1',
            id: '789',
            type: 'exception-list',
          },
        ],
      };

      expect(migration7150(alert, migrationContext)).toEqual(alert);
    });

    test('security solution will migrate with only missing data if we have partially migrated data', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
            exceptionsList: [
              {
                id: '123',
                list_id: '456',
                type: 'detection',
                namespace_type: 'single',
              },
              {
                id: '789',
                list_id: '0123',
                type: 'detection',
                namespace_type: 'single',
              },
            ],
          },
        }),
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
        ],
      };

      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
          {
            name: 'param:exceptionsList_1',
            id: '789',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution will not migrate if exception list if it is invalid data', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
            exceptionsList: [{ invalid: 'invalid' }],
          },
        }),
      };
      expect(migration7150(alert, migrationContext)).toEqual(alert);
    });

    test('security solution will migrate valid data if it is mixed with invalid data', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
            exceptionsList: [
              {
                id: '123',
                list_id: '456',
                type: 'detection',
                namespace_type: 'single',
              },
              { id: 555 }, // <-- Id is a number and not a string, and is invalid
              {
                id: '456',
                list_id: '456',
                type: 'detection',
                namespace_type: 'single',
              },
            ],
          },
        }),
      };
      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
          {
            name: 'param:exceptionsList_1',
            id: '456',
            type: 'exception-list',
          },
        ],
      });
    });

    test('security solution will not migrate if exception list is invalid data but will keep existing references', () => {
      const migration7150 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.15.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.signals',
          params: {
            note: 'some note',
            exceptionsList: [{ invalid: 'invalid' }],
          },
        }),
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
        ],
      };
      expect(migration7150(alert, migrationContext)).toEqual({
        ...alert,
        references: [
          {
            name: 'param:exceptionsList_0',
            id: '123',
            type: 'exception-list',
          },
        ],
      });
    });
  });

  describe('7.16.0', () => {
    test('add legacyId field to alert - set to SavedObject id attribute', () => {
      const migration716 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = getMockData({}, true);
      expect(migration716(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
      });
    });

    test('removes preconfigured connectors from references array', () => {
      isPreconfigured.mockReset();
      isPreconfigured.mockReturnValueOnce(true);
      isPreconfigured.mockReturnValueOnce(false);
      const migration716 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const rule = {
        ...getMockData({
          actions: [
            {
              actionRef: 'action_0',
              actionTypeId: '.slack',
              group: 'small',
              params: {
                message: 'preconfigured',
              },
            },
            {
              actionRef: 'action_1',
              actionTypeId: '.server-log',
              group: 'small',
              params: {
                level: 'info',
                message: 'boo',
              },
            },
          ],
        }),
        references: [
          {
            id: 'my-slack1',
            name: 'action_0',
            type: 'action',
          },
          {
            id: '997c0120-00ee-11ec-b067-2524946ba327',
            name: 'action_1',
            type: 'action',
          },
        ],
      };
      expect(migration716(rule, migrationContext)).toEqual({
        ...rule,
        attributes: {
          ...rule.attributes,
          legacyId: rule.id,
          actions: [
            {
              actionRef: 'preconfigured:my-slack1',
              actionTypeId: '.slack',
              group: 'small',
              params: {
                message: 'preconfigured',
              },
            },
            {
              actionRef: 'action_1',
              actionTypeId: '.server-log',
              group: 'small',
              params: {
                level: 'info',
                message: 'boo',
              },
            },
          ],
        },
        references: [
          {
            id: '997c0120-00ee-11ec-b067-2524946ba327',
            name: 'action_1',
            type: 'action',
          },
        ],
      });
    });

    test('removes preconfigured connectors from references array and maintains non-action references', () => {
      isPreconfigured.mockReset();
      isPreconfigured.mockReturnValueOnce(true);
      isPreconfigured.mockReturnValueOnce(false);
      isPreconfigured.mockReturnValueOnce(false);
      const migration716 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const rule = {
        ...getMockData({
          actions: [
            {
              actionRef: 'action_0',
              actionTypeId: '.slack',
              group: 'small',
              params: {
                message: 'preconfigured',
              },
            },
            {
              actionRef: 'action_1',
              actionTypeId: '.server-log',
              group: 'small',
              params: {
                level: 'info',
                message: 'boo',
              },
            },
          ],
        }),
        references: [
          {
            id: 'my-slack1',
            name: 'action_0',
            type: 'action',
          },
          {
            id: '997c0120-00ee-11ec-b067-2524946ba327',
            name: 'action_1',
            type: 'action',
          },
          {
            id: '3838d98c-67d3-49e8-b813-aa8404bb6b1a',
            name: 'params:something-else',
            type: 'some-other-type',
          },
        ],
      };
      expect(migration716(rule, migrationContext)).toEqual({
        ...rule,
        attributes: {
          ...rule.attributes,
          legacyId: rule.id,
          actions: [
            {
              actionRef: 'preconfigured:my-slack1',
              actionTypeId: '.slack',
              group: 'small',
              params: {
                message: 'preconfigured',
              },
            },
            {
              actionRef: 'action_1',
              actionTypeId: '.server-log',
              group: 'small',
              params: {
                level: 'info',
                message: 'boo',
              },
            },
          ],
        },
        references: [
          {
            id: '997c0120-00ee-11ec-b067-2524946ba327',
            name: 'action_1',
            type: 'action',
          },
          {
            id: '3838d98c-67d3-49e8-b813-aa8404bb6b1a',
            name: 'params:something-else',
            type: 'some-other-type',
          },
        ],
      });
    });

    test('does nothing to rules with no references', () => {
      isPreconfigured.mockReset();
      const migration716 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const rule = {
        ...getMockData({
          actions: [
            {
              actionRef: 'action_0',
              actionTypeId: '.slack',
              group: 'small',
              params: {
                message: 'preconfigured',
              },
            },
            {
              actionRef: 'action_1',
              actionTypeId: '.server-log',
              group: 'small',
              params: {
                level: 'info',
                message: 'boo',
              },
            },
          ],
        }),
        references: [],
      };
      expect(migration716(rule, migrationContext)).toEqual({
        ...rule,
        attributes: {
          ...rule.attributes,
          legacyId: rule.id,
        },
      });
    });

    test('does nothing to rules with no action references', () => {
      isPreconfigured.mockReset();
      const migration716 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const rule = {
        ...getMockData({
          actions: [
            {
              actionRef: 'action_0',
              actionTypeId: '.slack',
              group: 'small',
              params: {
                message: 'preconfigured',
              },
            },
            {
              actionRef: 'action_1',
              actionTypeId: '.server-log',
              group: 'small',
              params: {
                level: 'info',
                message: 'boo',
              },
            },
          ],
        }),
        references: [
          {
            id: '3838d98c-67d3-49e8-b813-aa8404bb6b1a',
            name: 'params:something-else',
            type: 'some-other-type',
          },
        ],
      };
      expect(migration716(rule, migrationContext)).toEqual({
        ...rule,
        attributes: {
          ...rule.attributes,
          legacyId: rule.id,
        },
      });
    });

    test('does nothing to rules with references but no actions', () => {
      isPreconfigured.mockReset();
      const migration716 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const rule = {
        ...getMockData({
          actions: [],
        }),
        references: [
          {
            id: 'my-slack1',
            name: 'action_0',
            type: 'action',
          },
          {
            id: '997c0120-00ee-11ec-b067-2524946ba327',
            name: 'action_1',
            type: 'action',
          },
        ],
      };
      expect(migration716(rule, migrationContext)).toEqual({
        ...rule,
        attributes: {
          ...rule.attributes,
          legacyId: rule.id,
        },
      });
    });

    test('security solution is migrated to saved object references if it has a "ruleAlertId"', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.notifications',
        params: {
          ruleAlertId: '123',
        },
      });

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      });
    });

    test('security solution does not migrate anything if its type is not siem.notifications', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = getMockData({
        alertTypeId: 'other-type',
        params: {
          ruleAlertId: '123',
        },
      });

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
      });
    });
    test('security solution does not change anything if "ruleAlertId" is missing', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = getMockData({
        alertTypeId: 'siem.notifications',
        params: {},
      });

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
      });
    });

    test('security solution will keep existing references if we do not have a "ruleAlertId" but we do already have references', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.notifications',
          params: {},
        }),
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      };

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      });
    });

    test('security solution will keep any foreign references if they exist but still migrate other "ruleAlertId" references', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.notifications',
          params: {
            ruleAlertId: '123',
          },
        }),
        references: [
          {
            name: 'foreign-name',
            id: '999',
            type: 'foreign-name',
          },
        ],
      };

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
        references: [
          {
            name: 'foreign-name',
            id: '999',
            type: 'foreign-name',
          },
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      });
    });

    test('security solution is idempotent and if re-run on the same migrated data will keep the same items "ruleAlertId" references', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.notifications',
          params: {
            ruleAlertId: '123',
          },
        }),
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      };

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      });
    });

    test('security solution will not migrate "ruleAlertId" if it is invalid data', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.notifications',
          params: {
            ruleAlertId: 55, // This is invalid if it is a number and not a string
          },
        }),
      };

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
      });
    });

    test('security solution will not migrate "ruleAlertId" if it is invalid data but will keep existing references', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: 'siem.notifications',
          params: {
            ruleAlertId: 456, // This is invalid if it is a number and not a string
          },
        }),
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      };

      expect(migration7160(alert, migrationContext)).toEqual({
        ...alert,
        attributes: {
          ...alert.attributes,
          legacyId: alert.id,
        },
        references: [
          {
            name: 'param:alert_0',
            id: '123',
            type: RULE_SAVED_OBJECT_TYPE,
          },
        ],
      });
    });

    test('geo-containment alert migration extracts boundary and index references', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: '.geo-containment',
          params: {
            indexId: 'foo',
            boundaryIndexId: 'bar',
          },
        }),
      };

      const migratedAlert = migration7160(alert, migrationContext);

      expect(migratedAlert.references).toEqual([
        { id: 'foo', name: 'param:tracked_index_foo', type: 'index-pattern' },
        { id: 'bar', name: 'param:boundary_index_bar', type: 'index-pattern' },
      ]);

      expect(migratedAlert.attributes.params).toEqual({
        boundaryIndexRefName: 'boundary_index_bar',
        indexRefName: 'tracked_index_foo',
      });

      expect(migratedAlert.attributes.params.indexId).toEqual(undefined);
      expect(migratedAlert.attributes.params.boundaryIndexId).toEqual(undefined);
    });

    test('geo-containment alert migration should preserve foreign references', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: '.geo-containment',
          params: {
            indexId: 'foo',
            boundaryIndexId: 'bar',
          },
        }),
        references: [
          {
            name: 'foreign-name',
            id: '999',
            type: 'foreign-name',
          },
        ],
      };

      const migratedAlert = migration7160(alert, migrationContext);

      expect(migratedAlert.references).toEqual([
        {
          name: 'foreign-name',
          id: '999',
          type: 'foreign-name',
        },
        { id: 'foo', name: 'param:tracked_index_foo', type: 'index-pattern' },
        { id: 'bar', name: 'param:boundary_index_bar', type: 'index-pattern' },
      ]);

      expect(migratedAlert.attributes.params).toEqual({
        boundaryIndexRefName: 'boundary_index_bar',
        indexRefName: 'tracked_index_foo',
      });

      expect(migratedAlert.attributes.params.indexId).toEqual(undefined);
      expect(migratedAlert.attributes.params.boundaryIndexId).toEqual(undefined);
    });

    test('geo-containment alert migration ignores other alert-types', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const alert = {
        ...getMockData({
          alertTypeId: '.foo',
          references: [
            {
              name: 'foreign-name',
              id: '999',
              type: 'foreign-name',
            },
          ],
        }),
      };

      const migratedAlert = migration7160(alert, migrationContext);

      expect(typeof migratedAlert.attributes.legacyId).toEqual('string'); // introduced by setLegacyId migration
      delete migratedAlert.attributes.legacyId;
      expect(migratedAlert).toEqual(alert);
    });
  });

  describe('8.0.0', () => {
    test('no op migration for rules SO', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );
      const alert = getMockData({}, true);
      expect(migration800(alert, migrationContext)).toEqual(alert);
    });

    test('add threatIndicatorPath default value to threat match rules if missing', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );
      const alert = getMockData(
        { params: { type: 'threat_match' }, alertTypeId: 'siem.signals' },
        true
      );
      expect(migration800(alert, migrationContext).attributes.params.threatIndicatorPath).toEqual(
        'threatintel.indicator'
      );
    });

    test('doesnt change threatIndicatorPath value in threat match rules if value is present', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );
      const alert = getMockData(
        {
          params: { type: 'threat_match', threatIndicatorPath: 'custom.indicator.path' },
          alertTypeId: 'siem.signals',
        },
        true
      );
      expect(migration800(alert, migrationContext).attributes.params.threatIndicatorPath).toEqual(
        'custom.indicator.path'
      );
    });

    test('doesnt change threatIndicatorPath value in other rules', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );
      const alert = getMockData({ params: { type: 'eql' }, alertTypeId: 'siem.signals' }, true);
      expect(migration800(alert, migrationContext).attributes.params.threatIndicatorPath).toEqual(
        undefined
      );
    });

    test('doesnt change threatIndicatorPath value if not a siem.signals rule', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );
      const alert = getMockData(
        { params: { type: 'threat_match' }, alertTypeId: 'not.siem.signals' },
        true
      );
      expect(migration800(alert, migrationContext).attributes.params.threatIndicatorPath).toEqual(
        undefined
      );
    });

    test('doesnt change AAD rule params if not a siem.signals rule', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );
      const alert = getMockData(
        { params: { outputIndex: 'output-index', type: 'query' }, alertTypeId: 'not.siem.signals' },
        true
      );
      const migratedAlert = migration800(alert, migrationContext);
      expect(migratedAlert.attributes.alertTypeId).toEqual('not.siem.signals');
      expect(migratedAlert.attributes.enabled).toEqual(true);
      expect(migratedAlert.attributes.tags).toEqual(['foo']);
      expect(migratedAlert.attributes.params.outputIndex).toEqual('output-index');
    });

    test.each(Object.keys(ruleTypeMappings) as RuleType[])(
      'changes AAD rule params accordingly if rule is a siem.signals %p rule',
      (ruleType) => {
        const migration800 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
        );
        const alert = getMockData(
          { params: { outputIndex: 'output-index', type: ruleType }, alertTypeId: 'siem.signals' },
          true
        );
        const migratedAlert = migration800(alert, migrationContext);
        expect(migratedAlert.attributes.alertTypeId).toEqual(ruleTypeMappings[ruleType]);
        expect(migratedAlert.attributes.enabled).toEqual(false);
        expect(migratedAlert.attributes.tags).toEqual(['foo']);
        expect(migratedAlert.attributes.params.outputIndex).toEqual('');
      }
    );
  });

  describe('8.0.1', () => {
    describe.each(Object.keys(ruleTypeMappings) as RuleType[])(
      'auto_disabled %p rule tags',
      (ruleType) => {
        const alert717Enabled = getMockData(
          {
            params: { outputIndex: 'output-index', type: ruleType },
            alertTypeId: 'siem.signals',
            enabled: true,
            scheduledTaskId: 'abcd',
          },
          true
        );
        const alert717Disabled = getMockData(
          {
            params: { outputIndex: 'output-index', type: ruleType },
            alertTypeId: 'siem.signals',
            enabled: false,
          },
          true
        );
        const alert800 = getMockData(
          {
            params: { outputIndex: '', type: ruleType },
            alertTypeId: ruleTypeMappings[ruleType],
            enabled: false,
            scheduledTaskId: 'abcd',
          },
          true
        );

        test('Does not update rule tags if rule has already been enabled', () => {
          const migrations = getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured);
          const migration800 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.0']);
          const migration801 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.1']);

          // migrate to 8.0.0
          const migratedAlert800 = migration800(alert717Enabled, migrationContext);
          expect(migratedAlert800.attributes.enabled).toEqual(false);

          // reenable rule
          migratedAlert800.attributes.enabled = true;

          // migrate to 8.0.1
          const migratedAlert801 = migration801(migratedAlert800, migrationContext);

          expect(migratedAlert801.attributes.alertTypeId).toEqual(ruleTypeMappings[ruleType]);
          expect(migratedAlert801.attributes.enabled).toEqual(true);
          expect(migratedAlert801.attributes.params.outputIndex).toEqual('');

          // tags not updated
          expect(migratedAlert801.attributes.tags).toEqual(['foo']);
        });

        test('Does not update rule tags if rule was already disabled before upgrading to 8.0', () => {
          const migrations = getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured);
          const migration800 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.0']);
          const migration801 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.1']);

          // migrate to 8.0.0
          const migratedAlert800 = migration800(alert717Disabled, migrationContext);
          expect(migratedAlert800.attributes.enabled).toEqual(false);

          // migrate to 8.0.1
          const migratedAlert801 = migration801(migratedAlert800, migrationContext);

          expect(migratedAlert801.attributes.alertTypeId).toEqual(ruleTypeMappings[ruleType]);
          expect(migratedAlert801.attributes.enabled).toEqual(false);
          expect(migratedAlert801.attributes.params.outputIndex).toEqual('');

          // tags not updated
          expect(migratedAlert801.attributes.tags).toEqual(['foo']);
        });

        test('Updates rule tags if rule was auto-disabled in 8.0 upgrade and not reenabled', () => {
          const migrations = getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured);
          const migration800 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.0']);
          const migration801 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.1']);

          // migrate to 8.0.0
          const migratedAlert800 = migration800(alert717Enabled, migrationContext);
          expect(migratedAlert800.attributes.enabled).toEqual(false);

          // migrate to 8.0.1
          const migratedAlert801 = migration801(migratedAlert800, migrationContext);

          expect(migratedAlert801.attributes.alertTypeId).toEqual(ruleTypeMappings[ruleType]);
          expect(migratedAlert801.attributes.enabled).toEqual(false);
          expect(migratedAlert801.attributes.params.outputIndex).toEqual('');

          // tags updated
          expect(migratedAlert801.attributes.tags).toEqual(['foo', 'auto_disabled_8.0']);
        });

        test('Updates rule tags correctly if tags are undefined', () => {
          const migrations = getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured);
          const migration801 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.1']);

          const alert = {
            ...alert800,
            attributes: {
              ...alert800.attributes,
              tags: undefined,
            },
          };

          // migrate to 8.0.1
          const migratedAlert801 = migration801(alert, migrationContext);

          expect(migratedAlert801.attributes.alertTypeId).toEqual(ruleTypeMappings[ruleType]);
          expect(migratedAlert801.attributes.enabled).toEqual(false);
          expect(migratedAlert801.attributes.params.outputIndex).toEqual('');

          // tags updated
          expect(migratedAlert801.attributes.tags).toEqual(['auto_disabled_8.0']);
        });

        test('Updates rule tags correctly if tags are null', () => {
          const migrations = getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured);
          const migration801 = SavedObjectsUtils.getMigrationFunction(migrations['8.0.1']);

          const alert = {
            ...alert800,
            attributes: {
              ...alert800.attributes,
              tags: null,
            },
          };

          // migrate to 8.0.1
          const migratedAlert801 = migration801(alert, migrationContext);

          expect(migratedAlert801.attributes.alertTypeId).toEqual(ruleTypeMappings[ruleType]);
          expect(migratedAlert801.attributes.enabled).toEqual(false);
          expect(migratedAlert801.attributes.params.outputIndex).toEqual('');

          // tags updated
          expect(migratedAlert801.attributes.tags).toEqual(['auto_disabled_8.0']);
        });
      }
    );
  });

  describe('8.2.0', () => {
    test('migrates params to mapped_params', () => {
      const migration820 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.2.0']
      );
      const alert = getMockData(
        {
          params: {
            risk_score: 60,
            severity: 'high',
            foo: 'bar',
          },
          alertTypeId: 'siem.signals',
        },
        true
      );

      const migratedAlert820 = migration820(alert, migrationContext);

      expect(migratedAlert820.attributes.mapped_params).toEqual({
        risk_score: 60,
        severity: '60-high',
      });
    });
  });

  describe('8.3.0', () => {
    test('migrates snoozed rules to the new data model', () => {
      const fakeTimer = sinon.useFakeTimers();
      const migration830 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.3.0']
      );
      const mutedAlert = getMockData(
        {
          snoozeEndTime: '1970-01-02T00:00:00.000Z',
        },
        true
      );
      const migratedMutedAlert830 = migration830(mutedAlert, migrationContext);

      expect(migratedMutedAlert830.attributes.snoozeSchedule.length).toEqual(1);
      expect(migratedMutedAlert830.attributes.snoozeSchedule[0].rRule.dtstart).toEqual(
        '1970-01-01T00:00:00.000Z'
      );
      expect(migratedMutedAlert830.attributes.snoozeSchedule[0].duration).toEqual(86400000);
      fakeTimer.restore();
    });

    test('migrates es_query alert params', () => {
      const migration830 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.3.0']
      );
      const alert = getMockData(
        {
          params: { esQuery: '{ "query": "test-query" }' },
          alertTypeId: '.es-query',
        },
        true
      );
      const migratedAlert820 = migration830(alert, migrationContext);

      expect(migratedAlert820.attributes.params).toEqual({
        esQuery: '{ "query": "test-query" }',
        searchType: 'esQuery',
      });
    });

    test('removes internal tags', () => {
      const migration830 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.3.0']
      );
      const alert = getMockData(
        {
          tags: [
            '__internal_immutable:false',
            '__internal_rule_id:064e3fed-6328-416b-bb85-c08265088f41',
            'test-tag',
          ],
          alertTypeId: 'siem.queryRule',
        },
        true
      );

      const migratedAlert830 = migration830(alert, migrationContext);

      expect(migratedAlert830.attributes.tags).toEqual(['test-tag']);
    });

    test('do not remove internal tags if rule is not Security solution rule', () => {
      const migration830 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.3.0']
      );
      const alert = getMockData(
        {
          tags: ['__internal_immutable:false', 'tag-1'],
        },
        true
      );

      const migratedAlert830 = migration830(alert, migrationContext);

      expect(migratedAlert830.attributes.tags).toEqual(['__internal_immutable:false', 'tag-1']);
    });
  });

  describe('8.4.1', () => {
    test('removes isSnoozedUntil', () => {
      const migration841 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.4.1']
      );
      const mutedAlert = getMockData(
        {
          isSnoozedUntil: '1970-01-02T00:00:00.000Z',
        },
        true
      );
      expect(mutedAlert.attributes.isSnoozedUntil).toBeTruthy();
      const migratedAlert841 = migration841(mutedAlert, migrationContext);

      expect(migratedAlert841.attributes.isSnoozedUntil).toBeFalsy();
    });

    test('works as expected if isSnoozedUntil is not populated', () => {
      const migration841 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.4.1']
      );
      const mutedAlert = getMockData({}, true);
      expect(mutedAlert.attributes.isSnoozedUntil).toBeFalsy();
      expect(() => migration841(mutedAlert, migrationContext)).not.toThrowError();
    });
  });

  describe('8.6.0', () => {
    test('migrates executionStatus success', () => {
      const migration860 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.6.0']
      );

      let ruleWithExecutionStatus = getMockData({
        executionStatus: {
          status: 'ok',
          lastExecutionDate: '2022-01-02T00:00:00.000Z',
          lastDuration: 60000,
        },
      });

      let migratedRule = migration860(ruleWithExecutionStatus, migrationContext);
      expect(migratedRule.attributes.lastRun.outcome).toEqual('succeeded');
      expect(migratedRule.attributes.lastRun.warning).toEqual(null);
      ruleWithExecutionStatus = getMockData({
        executionStatus: {
          status: 'active',
          lastExecutionDate: '2022-01-02T00:00:00.000Z',
          lastDuration: 60000,
        },
      });

      migratedRule = migration860(ruleWithExecutionStatus, migrationContext);
      expect(migratedRule.attributes.lastRun.outcome).toEqual('succeeded');
      expect(migratedRule.attributes.lastRun.warning).toEqual(null);
    });

    test('migrates executionStatus warning and error', () => {
      const migration860 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.6.0']
      );

      let ruleWithExecutionStatus = getMockData({
        executionStatus: {
          status: 'warning',
          lastExecutionDate: '2022-01-02T00:00:00.000Z',
          lastDuration: 60000,
          warning: {
            reason: 'warning reason',
            message: 'warning message',
          },
        },
      });

      let migratedRule = migration860(ruleWithExecutionStatus, migrationContext);
      expect(migratedRule.attributes.lastRun.outcome).toEqual('warning');
      expect(migratedRule.attributes.lastRun.outcomeMsg).toEqual('warning message');
      expect(migratedRule.attributes.lastRun.warning).toEqual('warning reason');

      ruleWithExecutionStatus = getMockData({
        executionStatus: {
          status: 'error',
          lastExecutionDate: '2022-01-02T00:00:00.000Z',
          lastDuration: 60000,
          error: {
            reason: 'failed reason',
            message: 'failed message',
          },
        },
      });

      migratedRule = migration860(ruleWithExecutionStatus, migrationContext);
      expect(migratedRule.attributes.lastRun.outcome).toEqual('failed');
      expect(migratedRule.attributes.lastRun.outcomeMsg).toEqual('failed message');
      expect(migratedRule.attributes.lastRun.warning).toEqual('failed reason');
    });

    test('migrates empty monitoring', () => {
      const migration860 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.6.0']
      );

      const ruleWithoutMonitoring = getMockData();
      const migratedRule = migration860(ruleWithoutMonitoring, migrationContext);

      expect(migratedRule.attributes.monitoring).toBeUndefined();
    });

    test('migrates empty monitoring when executionStatus exists', () => {
      const migration860 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.6.0']
      );

      const ruleWithMonitoring = getMockData({
        executionStatus: {
          status: 'ok',
          lastExecutionDate: '2022-01-02T00:00:00.000Z',
          lastDuration: 60000,
        },
      });
      const migratedRule = migration860(ruleWithMonitoring, migrationContext);

      expect(migratedRule.attributes.monitoring.run.history).toEqual([]);
      expect(migratedRule.attributes.monitoring.run.last_run.timestamp).toEqual(
        '2022-01-02T00:00:00.000Z'
      );
      expect(migratedRule.attributes.monitoring.run.last_run.metrics.duration).toEqual(60000);
    });
  });

  describe('8.7.0', () => {
    describe('es_query rule', () => {
      test('migrates es_query rule params and adds group by fields', () => {
        const migration870 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.7.0']
        );
        const rule = getMockData(
          {
            params: { esQuery: '{ "query": "test-query" }', searchType: 'esQuery' },
            alertTypeId: '.es-query',
          },
          true
        );
        const migratedAlert870 = migration870(rule, migrationContext);

        expect(migratedAlert870.attributes.params).toEqual({
          esQuery: '{ "query": "test-query" }',
          searchType: 'esQuery',
          aggType: 'count',
          groupBy: 'all',
        });
      });

      test('does not migrate rule params if rule is not es query', () => {
        const migration870 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.7.0']
        );
        const rule = getMockData(
          {
            params: { foo: true },
            alertTypeId: '.not-es-query',
          },
          true
        );
        const migratedAlert870 = migration870(rule, migrationContext);

        expect(migratedAlert870.attributes.params).toEqual({ foo: true });
      });
    });

    describe('log threshold rule', () => {
      const logThresholdAlertTypeId = 'logs.alert.document.count';
      const logViewId = 'log-view-reference-0';

      const params = {
        timeSize: 5,
        timeUnit: 'm',
        count: {
          value: 75,
          comparator: 'more than',
        },
        criteria: [
          {
            field: 'log.level',
            comparator: 'equals',
            value: 'error',
          },
        ],
      };

      const logView = {
        logViewId,
        type: 'log-view-reference',
      };

      const references = [
        {
          name: `param:${logViewId}`,
          type: 'infrastructure-monitoring-log-view',
          id: 'default',
        },
      ];

      test('should migrate and add the logView param and its reference', () => {
        const migration870 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.7.0']
        );
        const rule = getMockData({ params, alertTypeId: logThresholdAlertTypeId }, true);
        const migratedAlert870 = migration870(rule, migrationContext);

        expect(migratedAlert870.attributes.params).toEqual({
          ...params,
          logView,
        });
        expect(migratedAlert870.references).toEqual(references);
      });

      test('should not migrate the rule if is not of type logs.alert.document.count', () => {
        const migration870 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.7.0']
        );
        const rule = getMockData({ params, alertTypeId: `not-${logThresholdAlertTypeId}` }, true);
        const migratedAlert870 = migration870(rule, migrationContext);

        expect(migratedAlert870.attributes.params).toEqual(params);
        expect(migratedAlert870.references).toEqual([]);
      });
    });

    test('migrates last run outcome order', () => {
      const migration870 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.7.0']
      );

      // Failed rule
      const failedRule = getMockData({ lastRun: { outcome: 'failed' } });
      const failedRule870 = migration870(failedRule, migrationContext);
      expect(failedRule870.attributes.lastRun).toEqual({ outcome: 'failed', outcomeOrder: 20 });

      // Rule with warnings
      const warningRule = getMockData({ lastRun: { outcome: 'warning' } });
      const warningRule870 = migration870(warningRule, migrationContext);
      expect(warningRule870.attributes.lastRun).toEqual({ outcome: 'warning', outcomeOrder: 10 });

      // Succeeded rule
      const succeededRule = getMockData({ lastRun: { outcome: 'succeeded' } });
      const succeededRule870 = migration870(succeededRule, migrationContext);
      expect(succeededRule870.attributes.lastRun).toEqual({
        outcome: 'succeeded',
        outcomeOrder: 0,
      });
    });
  });

  describe('8.8.0', () => {
    test('adds uuid to rule actions', () => {
      const migration880 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
      );
      const rule = getMockData(
        {
          params: { foo: true },
          alertTypeId: '.not-es-query',
        },
        true
      );
      const migratedAlert880 = migration880(rule, migrationContext);

      expect(migratedAlert880.attributes.actions).toEqual([
        {
          group: 'default',
          actionRef: '1',
          actionTypeId: '1',
          params: { foo: true },
          uuid: expect.stringMatching(/.*\S.*/), // non-empty string
        },
      ]);
    });

    describe('security rule version to revision', () => {
      test('migrates rule to include revision and defaults revision to 0', () => {
        const migration880 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
        );

        const rule = getMockData();
        const migratedAlert880 = migration880(rule, migrationContext);
        expect(migratedAlert880.attributes.revision).toEqual(0);
      });

      test('migrates security rule version to revision', () => {
        const migration880 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
        );

        const rule = getMockData({ alertTypeId: ruleTypeMappings.eql, params: { version: 2 } });
        const migratedAlert880 = migration880(rule, migrationContext);
        expect(migratedAlert880.attributes.revision).toEqual(2);
      });
    });

    describe('migrate actions frequency for Security Solution ', () => {
      test('Add frequency when throttle is null', () => {
        const migration880 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
        );

        const rule = getMockData({ alertTypeId: ruleTypeMappings.eql });
        const migratedAlert880 = migration880(rule, migrationContext);
        expect(migratedAlert880.attributes.actions[0].frequency.summary).toEqual(true);
        expect(migratedAlert880.attributes.actions[0].frequency.notifyWhen).toEqual(
          'onActiveAlert'
        );
        expect(migratedAlert880.attributes.actions[0].frequency.throttle).toEqual(null);
      });

      test('Add frequency when throttle is 1h', () => {
        const migration880 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
        );

        const rule = getMockData({ alertTypeId: ruleTypeMappings.eql, throttle: '1h' });
        const migratedAlert880 = migration880(rule, migrationContext);
        expect(migratedAlert880.attributes.actions[0].frequency.summary).toEqual(true);
        expect(migratedAlert880.attributes.actions[0].frequency.notifyWhen).toEqual(
          'onThrottleInterval'
        );
        expect(migratedAlert880.attributes.actions[0].frequency.throttle).toEqual('1h');
      });

      test('Do not migrate action when alert does NOT belong to security solution', () => {
        const migration880 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
        );

        const rule = getMockData();
        const migratedAlert880 = migration880(rule, migrationContext);
        const updatedActions = migratedAlert880.attributes.actions.map(
          (action: { [x: string]: unknown; uuid: unknown }) => {
            const { uuid, ...updatedAction } = action;
            return updatedAction;
          }
        );
        expect(updatedActions).toEqual(rule.attributes.actions);
      });
    });

    describe('unmute security rules', () => {
      test.each(Object.values(ruleTypeMappings))(
        'unmutes custom rules of type "%s" successfully',
        (ruleType) => {
          const migration880 = SavedObjectsUtils.getMigrationFunction(
            getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
          );

          const rule = getMockData({ alertTypeId: ruleType, muteAll: true });
          const migratedAlert880 = migration880(rule, migrationContext);

          expect(migratedAlert880.attributes.muteAll).toBeFalsy();
        }
      );

      test('ignores non security rules', () => {
        const migration880 = SavedObjectsUtils.getMigrationFunction(
          getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.8.0']
        );

        const rule = getMockData({
          alertTypeId: 'unknown',
          muteAll: true,
        });
        const migratedAlert880 = migration880(rule, migrationContext);

        expect(migratedAlert880.attributes.muteAll).toBeTruthy();
      });
    });
  });

  describe('Metrics Inventory Threshold rule', () => {
    test('Migrates incorrect action group spelling', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );

      const actions = [
        {
          group: 'metrics.invenotry_threshold.fired',
          params: {
            level: 'info',
            message:
              '""{{alertName}} - {{context.group}} is in a state of {{context.alertState}} Reason: {{context.reason}}""',
          },
          actionRef: 'action_0',
          actionTypeId: '.server-log',
        },
      ];

      const alert = getMockData({ alertTypeId: 'metrics.alert.inventory.threshold', actions });

      expect(migration800(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [{ ...actions[0], group: 'metrics.inventory_threshold.fired' }],
        },
      });
    });

    test('Works with the correct action group spelling', () => {
      const migration800 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['8.0.0']
      );

      const actions = [
        {
          group: 'metrics.inventory_threshold.fired',
          params: {
            level: 'info',
            message:
              '""{{alertName}} - {{context.group}} is in a state of {{context.alertState}} Reason: {{context.reason}}""',
          },
          actionRef: 'action_0',
          actionTypeId: '.server-log',
        },
      ];

      const alert = getMockData({ alertTypeId: 'metrics.alert.inventory.threshold', actions });

      expect(migration800(alert, migrationContext)).toMatchObject({
        ...alert,
        attributes: {
          ...alert.attributes,
          actions: [{ ...actions[0], group: 'metrics.inventory_threshold.fired' }],
        },
      });
    });
  });
});

describe('search source migration', () => {
  it('should apply migration within es query alert rule', () => {
    const esQueryRuleSavedObject = {
      attributes: {
        params: {
          searchConfiguration: {
            some: 'prop',
            migrated: false,
          },
        },
      },
    } as SavedObjectUnsanitizedDoc;

    const versionToTest = '9.1.3';
    const migrations = getMigrations(
      encryptedSavedObjectsSetup,
      {
        [versionToTest]: (state) => ({ ...state, migrated: true }),
      },
      isPreconfigured
    );

    expect(
      SavedObjectsUtils.getMigrationFunction(migrations[versionToTest])(
        esQueryRuleSavedObject,
        {} as SavedObjectMigrationContext
      )
    ).toEqual({
      attributes: {
        params: {
          searchConfiguration: {
            some: 'prop',
            migrated: true,
          },
        },
      },
    });
  });

  it('should not apply migration within es query alert rule when searchConfiguration not an object', () => {
    const esQueryRuleSavedObject = {
      attributes: {
        params: {
          searchConfiguration: 5,
        },
      },
    } as SavedObjectUnsanitizedDoc;

    const versionToTest = '9.1.4';
    const migrations = getMigrations(
      encryptedSavedObjectsSetup,
      {
        [versionToTest]: (state) => ({ ...state, migrated: true }),
      },
      isPreconfigured
    );

    expect(
      SavedObjectsUtils.getMigrationFunction(migrations[versionToTest])(
        esQueryRuleSavedObject,
        {} as SavedObjectMigrationContext
      )
    ).toEqual({
      attributes: {
        params: {
          searchConfiguration: 5,
        },
      },
    });
  });
});

describe('handles errors during migrations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    encryptedSavedObjectsSetup.createMigration.mockImplementation(() => () => {
      throw new Error(`Can't migrate!`);
    });
  });
  describe('7.10.0 throws if migration fails', () => {
    test('should show the proper exception', () => {
      const migration710 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.10.0']
      );
      const alert = getMockData({
        consumer: 'alerting',
      });
      expect(() => {
        migration710(alert, migrationContext);
      }).toThrowError(`Can't migrate!`);
      expect(migrationContext.log.error).toHaveBeenCalledWith(
        `encryptedSavedObject 7.10.0 migration failed for alert ${alert.id} with error: Can't migrate!`,
        {
          migrations: {
            alertDocument: {
              ...alert,
              attributes: {
                ...alert.attributes,
              },
            },
          },
        }
      );
    });
  });

  describe('7.11.0 throws if migration fails', () => {
    test('should show the proper exception', () => {
      const migration711 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.0']
      );
      const alert = getMockData({
        consumer: 'alerting',
      });
      expect(() => {
        migration711(alert, migrationContext);
      }).toThrowError(`Can't migrate!`);
      expect(migrationContext.log.error).toHaveBeenCalledWith(
        `encryptedSavedObject 7.11.0 migration failed for alert ${alert.id} with error: Can't migrate!`,
        {
          migrations: {
            alertDocument: {
              ...alert,
              attributes: {
                ...alert.attributes,
              },
            },
          },
        }
      );
    });
  });

  describe('7.11.2 throws if migration fails', () => {
    test('should show the proper exception', () => {
      const migration7112 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.11.2']
      );
      const alert = getMockData({
        consumer: 'alerting',
      });
      expect(() => {
        migration7112(alert, migrationContext);
      }).toThrowError(`Can't migrate!`);
      expect(migrationContext.log.error).toHaveBeenCalledWith(
        `encryptedSavedObject 7.11.2 migration failed for alert ${alert.id} with error: Can't migrate!`,
        {
          migrations: {
            alertDocument: {
              ...alert,
              attributes: {
                ...alert.attributes,
              },
            },
          },
        }
      );
    });
  });

  describe('7.13.0 throws if migration fails', () => {
    test('should show the proper exception', () => {
      const migration7130 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.13.0']
      );
      const alert = getMockData({
        consumer: 'alerting',
      });
      expect(() => {
        migration7130(alert, migrationContext);
      }).toThrowError(`Can't migrate!`);
      expect(migrationContext.log.error).toHaveBeenCalledWith(
        `encryptedSavedObject 7.13.0 migration failed for alert ${alert.id} with error: Can't migrate!`,
        {
          migrations: {
            alertDocument: {
              ...alert,
              attributes: {
                ...alert.attributes,
              },
            },
          },
        }
      );
    });
  });

  describe('7.16.0 throws if migration fails', () => {
    test('should show the proper exception', () => {
      const migration7160 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(encryptedSavedObjectsSetup, {}, isPreconfigured)['7.16.0']
      );
      const rule = getMockData();
      expect(() => {
        migration7160(rule, migrationContext);
      }).toThrowError(`Can't migrate!`);
      expect(migrationContext.log.error).toHaveBeenCalledWith(
        `encryptedSavedObject 7.16.0 migration failed for alert ${rule.id} with error: Can't migrate!`,
        {
          migrations: {
            alertDocument: {
              ...rule,
              attributes: {
                ...rule.attributes,
              },
            },
          },
        }
      );
    });
  });

  describe('8.3.0 throws if migration fails', () => {
    test('should show the proper exception on search source migration', () => {
      encryptedSavedObjectsSetup.createMigration.mockImplementation(({ migration }) => migration);
      const mockRule = getMockData();
      const rule = {
        ...mockRule,
        attributes: {
          ...mockRule.attributes,
          params: {
            searchConfiguration: {
              some: 'prop',
              migrated: false,
            },
          },
        },
      };

      const versionToTest = '8.3.0';
      const migration830 = SavedObjectsUtils.getMigrationFunction(
        getMigrations(
          encryptedSavedObjectsSetup,
          {
            [versionToTest]: () => {
              throw new Error(`Can't migrate search source!`);
            },
          },
          isPreconfigured
        )[versionToTest]
      );

      expect(() => {
        migration830(rule, migrationContext);
      }).toThrowError(`Can't migrate search source!`);
      expect(migrationContext.log.error).toHaveBeenCalledWith(
        `encryptedSavedObject ${versionToTest} migration failed for alert ${rule.id} with error: Can't migrate search source!`,
        {
          migrations: {
            alertDocument: {
              ...rule,
              attributes: {
                ...rule.attributes,
              },
            },
          },
        }
      );
    });
  });
});

function getUpdatedAt(): string {
  const updatedAt = new Date();
  updatedAt.setHours(updatedAt.getHours() + 2);
  return updatedAt.toISOString();
}

function getMockData(
  overwrites: Record<string, unknown> = {},
  withSavedObjectUpdatedAt = false
): SavedObjectUnsanitizedDoc<Partial<RawRule>> {
  return {
    attributes: {
      enabled: true,
      name: 'abc',
      tags: ['foo'],
      alertTypeId: '123',
      consumer: 'bar',
      apiKey: '',
      apiKeyOwner: '',
      schedule: { interval: '10s' },
      throttle: null,
      params: {
        bar: true,
      },
      muteAll: false,
      mutedInstanceIds: [],
      createdBy: new Date().toISOString(),
      updatedBy: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      actions: [
        {
          group: 'default',
          actionRef: '1',
          actionTypeId: '1',
          params: {
            foo: true,
          },
        } as unknown as RawRuleAction,
      ],
      ...overwrites,
    },
    references: [],
    updated_at: withSavedObjectUpdatedAt ? getUpdatedAt() : undefined,
    id: uuidv4(),
    type: RULE_SAVED_OBJECT_TYPE,
  };
}
