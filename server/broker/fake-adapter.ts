import type {BrokerStore,BrokerRecord,FakeRecord} from './store';
export type FakeAdapter={create(record:BrokerRecord):Promise<FakeRecord>;lookup(record:BrokerRecord):Promise<FakeRecord|undefined>;cancel(record:BrokerRecord):Promise<FakeRecord|undefined>};
export const fakeRunKey=(record:BrokerRecord)=>`${record.owner}:${record.review.run.runId}`;
/** No network or executable user instructions: acceptance is a durable metadata-only deterministic fake. */
export function createDeterministicAdapter(store:BrokerStore):FakeAdapter{return {async create(record){return store.fakeCreate({runKey:fakeRunKey(record),requestSha256:record.review.requestSha256,deadlineAt:record.deadlineAt});},async lookup(record){return store.fakeLookup(fakeRunKey(record));},async cancel(record){return store.fakeCancel(fakeRunKey(record));}};}
export function fakeState(record:FakeRecord,now:number){if(record.cancelledAt!==undefined)return 'cancelled' as const;if(now>=record.acceptedAt+2000&&record.acceptedAt+2000<=record.deadlineAt)return 'completed' as const;if(now>=record.deadlineAt)return 'expired' as const;return now>=record.acceptedAt+1000?'running' as const:'queued' as const;}
