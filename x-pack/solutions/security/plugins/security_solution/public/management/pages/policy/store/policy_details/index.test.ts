/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { PolicyDetailsState } from '../../types';
import type { Dispatch, Store } from 'redux';
import { applyMiddleware, createStore } from 'redux';
import type { PolicyDetailsAction } from '.';
import { policyDetailsReducer, policyDetailsMiddlewareFactory } from '.';
import { policyConfig } from './selectors';
import { policyFactory } from '../../../../../../common/endpoint/models/policy_config';
import type { PolicyConfig, PolicyData } from '../../../../../../common/endpoint/types';
import type { MiddlewareActionSpyHelper } from '../../../../../common/store/test_utils';
import { createSpyMiddleware } from '../../../../../common/store/test_utils';
import type { AppContextTestRender } from '../../../../../common/mock/endpoint';
import { createAppRootMockRenderer } from '../../../../../common/mock/endpoint';
import type { HttpFetchOptions } from '@kbn/core/public';
import { cloneDeep } from 'lodash';
import { licenseMock } from '@kbn/licensing-plugin/common/licensing.mock';

describe('policy details: ', () => {
  let store: Store;
  let getState: (typeof store)['getState'];
  let dispatch: Dispatch<PolicyDetailsAction>;
  let policyItem: PolicyData;

  const generateNewPolicyItemMock = (): PolicyData => {
    return {
      id: '',
      name: '',
      description: '',
      created_at: '',
      created_by: '',
      updated_at: '',
      updated_by: '',
      policy_id: '',
      policy_ids: [''],
      enabled: true,
      inputs: [
        {
          type: 'endpoint',
          enabled: true,
          streams: [],
          config: {
            artifact_manifest: {
              value: {
                manifest_version: 'WzAsMF0=',
                schema_version: 'v1',
                artifacts: {},
              },
            },
            policy: {
              value: policyFactory(),
            },
          },
        },
      ],
      namespace: '',
      package: {
        name: '',
        title: '',
        version: '',
      },
      revision: 1,
    };
  };

  beforeEach(() => {
    policyItem = generateNewPolicyItemMock();
  });

  describe('When interacting with policy form', () => {
    beforeEach(() => {
      store = createStore(policyDetailsReducer);
      getState = store.getState;
      dispatch = store.dispatch;

      dispatch({
        type: 'serverReturnedPolicyDetailsData',
        payload: {
          policyItem,
        },
      });
    });

    describe('when the user has enabled windows process events', () => {
      beforeEach(() => {
        const config = policyConfig(getState());
        if (!config) {
          throw new Error();
        }

        const newPayload1 = cloneDeep(config);
        newPayload1.windows.events.process = true;

        dispatch({
          type: 'userChangedPolicyConfig',
          payload: { policyConfig: newPayload1 },
        });
      });

      it('windows process events is enabled', () => {
        const config = policyConfig(getState());
        expect(config.windows.events.process).toEqual(true);
      });
    });

    describe('when the user has enabled mac file events', () => {
      beforeEach(() => {
        const config = policyConfig(getState());
        if (!config) {
          throw new Error();
        }

        const newPayload1 = cloneDeep(config);
        newPayload1.mac.events.file = true;

        dispatch({
          type: 'userChangedPolicyConfig',
          payload: { policyConfig: newPayload1 },
        });
      });

      it('mac file events is enabled', () => {
        const config = policyConfig(getState());
        expect(config.mac.events.file).toEqual(true);
      });
    });

    describe('when the user has enabled linux process events', () => {
      beforeEach(() => {
        const config = policyConfig(getState());
        if (!config) {
          throw new Error();
        }

        const newPayload1 = cloneDeep(config);
        newPayload1.linux.events.file = true;

        dispatch({
          type: 'userChangedPolicyConfig',
          payload: { policyConfig: newPayload1 },
        });
      });

      it('linux file events is enabled', () => {
        const config = policyConfig(getState());
        expect(config.linux.events.file).toEqual(true);
      });
    });

    describe('when the policy config has paid features enabled', () => {
      const CustomMessage = 'Some Popup message change';
      const Basic = licenseMock.createLicense({ license: { type: 'basic', mode: 'basic' } });
      const Platinum = licenseMock.createLicense({
        license: { type: 'platinum', mode: 'platinum' },
      });

      beforeEach(() => {
        const config = policyConfig(getState());
        if (!config) {
          throw new Error();
        }

        // have a paid-policy field existing in the store from a previous time
        const newPayload1 = cloneDeep(config);
        newPayload1.windows.popup.malware.message = CustomMessage;
        dispatch({
          type: 'userChangedPolicyConfig',
          payload: { policyConfig: newPayload1 },
        });
      });

      it('preserves paid fields when license level allows', () => {
        dispatch({
          type: 'licenseChanged',
          payload: Platinum,
        });
        const config = policyConfig(getState());

        expect(config.windows.popup.malware.message).toEqual(CustomMessage);
      });

      it('reverts paid fields to default when license level does not allow', () => {
        dispatch({
          type: 'licenseChanged',
          payload: Basic,
        });
        const config = policyConfig(getState());

        expect(config.windows.popup.malware.message).not.toEqual(CustomMessage);
      });
    });
  });

  describe('when saving policy data', () => {
    let waitForAction: MiddlewareActionSpyHelper['waitForAction'];
    let http: AppContextTestRender['coreStart']['http'];

    beforeEach(() => {
      let actionSpyMiddleware: MiddlewareActionSpyHelper<PolicyDetailsState>['actionSpyMiddleware'];
      const { coreStart, depsStart } = createAppRootMockRenderer();
      ({ actionSpyMiddleware, waitForAction } = createSpyMiddleware<PolicyDetailsState>());
      http = coreStart.http;

      store = createStore(
        policyDetailsReducer,
        undefined,
        applyMiddleware(policyDetailsMiddlewareFactory(coreStart, depsStart), actionSpyMiddleware)
      );
      getState = store.getState;
      dispatch = store.dispatch;

      dispatch({
        type: 'serverReturnedPolicyDetailsData',
        payload: {
          policyItem,
        },
      });
    });

    it('should handle HTTP 409 (version missmatch) and still save the policy', async () => {
      policyItem.inputs[0].config.policy.value.windows.events.dns = false;

      const http409Error: Error & { response?: { status: number } } = new Error('conflict');
      http409Error.response = { status: 409 };

      // The most current Policy Item. Differences to `artifact_manifest` should be preserved,
      // while the policy data should be overwritten on next `put`.
      const mostCurrentPolicyItem = generateNewPolicyItemMock();
      mostCurrentPolicyItem.inputs[0].config.artifact_manifest.value.manifest_version = 'updated';
      mostCurrentPolicyItem.inputs[0].config.policy.value.windows.events.dns = true;

      http.put.mockRejectedValueOnce(http409Error);
      http.get.mockResolvedValueOnce({
        item: mostCurrentPolicyItem,
        success: true,
      });
      http.put.mockResolvedValueOnce({
        item: policyItem,
        success: true,
      });

      dispatch({ type: 'userClickedPolicyDetailsSaveButton' });
      await waitForAction('serverReturnedUpdatedPolicyDetailsData');

      expect(http.put).toHaveBeenCalledTimes(2);

      const lastPutCallPayload = (
        http.put.mock.calls[http.put.mock.calls.length - 1] as unknown as [string, HttpFetchOptions]
      )[1];

      // license is below platinum in this test, paid features are off
      expect(JSON.parse(lastPutCallPayload.body as string)).toEqual({
        name: '',
        description: '',
        policy_id: '',
        policy_ids: [''],
        enabled: true,
        inputs: [
          {
            type: 'endpoint',
            enabled: true,
            streams: [],
            config: {
              artifact_manifest: {
                value: { manifest_version: 'updated', schema_version: 'v1', artifacts: {} },
              },
              policy: {
                value: {
                  global_manifest_version: 'latest',
                  global_telemetry_enabled: false,
                  meta: {
                    license: '',
                    cloud: false,
                    license_uuid: '',
                    cluster_name: '',
                    cluster_uuid: '',
                    serverless: false,
                    billable: false,
                  },
                  windows: {
                    events: {
                      credential_access: true,
                      dll_and_driver_load: true,
                      dns: false,
                      file: true,
                      network: true,
                      process: true,
                      registry: true,
                      security: true,
                    },
                    malware: { mode: 'prevent', blocklist: true, on_write_scan: true },
                    memory_protection: { mode: 'off', supported: false },
                    behavior_protection: {
                      mode: 'off',
                      supported: false,
                      reputation_service: false,
                    },
                    ransomware: { mode: 'off', supported: false },
                    attack_surface_reduction: {
                      credential_hardening: {
                        enabled: false,
                      },
                    },
                    popup: {
                      malware: {
                        enabled: true,
                        message: '',
                      },
                      ransomware: {
                        enabled: false,
                        message: '',
                      },
                      memory_protection: {
                        enabled: false,
                        message: '',
                      },
                      behavior_protection: {
                        enabled: false,
                        message: '',
                      },
                    },
                    logging: { file: 'info' },
                    antivirus_registration: {
                      enabled: true,
                      mode: 'sync_with_malware_prevent',
                    },
                  },
                  mac: {
                    events: { dns: true, process: true, file: true, network: true, security: true },
                    malware: { mode: 'prevent', blocklist: true, on_write_scan: true },
                    behavior_protection: {
                      mode: 'off',
                      supported: false,
                      reputation_service: false,
                    },
                    memory_protection: { mode: 'off', supported: false },
                    popup: {
                      malware: {
                        enabled: true,
                        message: '',
                      },
                      behavior_protection: {
                        enabled: false,
                        message: '',
                      },
                      memory_protection: {
                        enabled: false,
                        message: '',
                      },
                    },
                    logging: { file: 'info' },
                    advanced: {
                      capture_env_vars:
                        'DYLD_INSERT_LIBRARIES,DYLD_FRAMEWORK_PATH,DYLD_LIBRARY_PATH,LD_PRELOAD',
                    },
                  },
                  linux: {
                    events: {
                      process: true,
                      file: true,
                      network: true,
                      session_data: false,
                      tty_io: false,
                    },
                    logging: { file: 'info' },
                    malware: { mode: 'prevent', blocklist: true, on_write_scan: true },
                    behavior_protection: {
                      mode: 'off',
                      supported: false,
                      reputation_service: false,
                    },
                    memory_protection: { mode: 'off', supported: false },
                    popup: {
                      malware: {
                        enabled: true,
                        message: '',
                      },
                      behavior_protection: {
                        enabled: false,
                        message: '',
                      },
                      memory_protection: {
                        enabled: false,
                        message: '',
                      },
                    },
                    advanced: {
                      capture_env_vars: 'LD_PRELOAD,LD_LIBRARY_PATH',
                    },
                  },
                } as PolicyConfig,
              },
            },
          },
        ],
        namespace: '',
        package: { name: '', title: '', version: '' },
      });
    });

    it('should not attempt to handle other HTTP errors', async () => {
      const http400Error: Error & { response?: { status: number } } = new Error('not found');

      http400Error.response = { status: 400 };
      http.put.mockRejectedValueOnce(http400Error);
      dispatch({ type: 'userClickedPolicyDetailsSaveButton' });

      const failureAction = await waitForAction('serverReturnedPolicyDetailsUpdateFailure');
      expect(failureAction.payload?.error).toBeInstanceOf(Error);
      expect(failureAction.payload?.error?.message).toEqual('not found');
    });
  });
});
