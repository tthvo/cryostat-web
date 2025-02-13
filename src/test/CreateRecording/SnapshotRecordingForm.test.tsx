/*
 * Copyright The Cryostat Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SnapshotRecordingForm } from '@app/CreateRecording/SnapshotRecordingForm';
import { authFailMessage } from '@app/ErrorView/types';
import { ActiveRecording, RecordingState } from '@app/Shared/Services/api.types';
import { ServiceContext, Services, defaultServices } from '@app/Shared/Services/Services';
import { TargetService } from '@app/Shared/Services/Target.service';
import { screen, cleanup, act as doAct } from '@testing-library/react';
import { of, Subject } from 'rxjs';
import { render, renderSnapshot } from '../utils';

const mockConnectUrl = 'service:jmx:rmi://someUrl';
const mockTarget = {
  agent: false,
  connectUrl: mockConnectUrl,
  alias: 'fooTarget',
  jvmId: 'foo',
  labels: [],
  annotations: { cryostat: [], platform: [] },
};
const mockRecording: ActiveRecording = {
  id: 100,
  state: RecordingState.RUNNING,
  duration: 1010,
  startTime: 9999,
  continuous: false,
  toDisk: false,
  maxSize: 55,
  maxAge: 66,
  remoteId: 77,
  name: 'snapshot-10',
  downloadUrl: 'http://localhost:8080/api/v4/targets/1/recordings/77',
  reportUrl: 'http://localhost:8080/api/v4/targets/1/reports/77',
  metadata: {
    labels: [],
  },
};

jest.spyOn(defaultServices.target, 'authFailure').mockReturnValue(of());
jest.spyOn(defaultServices.target, 'target').mockReturnValue(of(mockTarget));
jest.spyOn(defaultServices.target, 'sslFailure').mockReturnValue(of());
jest.spyOn(defaultServices.target, 'authRetry').mockReturnValue(of());

const mockNavigate = jest.fn();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

describe('<SnapshotRecordingForm />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders correctly', async () => {
    const tree = await renderSnapshot({
      routerConfigs: {
        routes: [
          {
            path: '/recordings',
            element: <>Recordings</>,
          },
          { path: '/recordings/create', element: <SnapshotRecordingForm /> },
        ],
      },
    });
    expect(tree?.toJSON()).toMatchSnapshot();
  });

  it('should create Recording when create is clicked', async () => {
    const onCreateSpy = jest.spyOn(defaultServices.api, 'createSnapshot').mockReturnValue(of(mockRecording));
    const { user } = render({
      routerConfigs: {
        routes: [
          {
            path: '/recordings',
            element: <>Recordings</>,
          },
          { path: '/recordings/create', element: <SnapshotRecordingForm /> },
        ],
      },
    });

    const createButton = screen.getByText('Create');
    expect(createButton).toBeInTheDocument();
    expect(createButton).toBeVisible();

    await user.click(createButton);

    expect(onCreateSpy).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('..', { relative: 'path' });
  });

  it('should show error view if failing to retrieve templates or Recording options', async () => {
    const authSubj = new Subject<void>();
    const mockTargetSvc = {
      ...defaultServices.target,
      authFailure: () => authSubj.asObservable(),
    } as TargetService;
    const services: Services = {
      ...defaultServices,
      target: mockTargetSvc,
    };
    render({
      routerConfigs: {
        routes: [
          {
            path: '/recordings',
            element: <>Recordings</>,
          },
          { path: '/recordings/create', element: <SnapshotRecordingForm /> },
        ],
      },
      providers: [{ kind: ServiceContext.Provider, instance: services }],
    });

    await doAct(async () => authSubj.next());

    const failTitle = screen.getByText('Error displaying Recording creation form');
    expect(failTitle).toBeInTheDocument();
    expect(failTitle).toBeVisible();

    const authFailText = screen.getByText(authFailMessage);
    expect(authFailText).toBeInTheDocument();
    expect(authFailText).toBeVisible();

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).toBeVisible();
  });
});
