import { Bytes } from "@graphprotocol/graph-ts";
import { BI_0 } from "./constants";
import { Proposal } from "./types/schema";
import {
  ProposalCreated,
  ProposalCanceled,
  ProposalExecuted,
  VoteCast,
  ProposalQueued,
} from "./types/Governance/Governance";

export function handleNewProposal(event: ProposalCreated): void {
  const proposal = new Proposal(event.params.id.toString());

  proposal.proposer = event.params.proposer;

  // @ts-ignore
  proposal.targets = changetype<Array<Bytes>>(event.params.targets);
  proposal.values = event.params.values;
  proposal.signatures = event.params.signatures;
  proposal.calldatas = event.params.calldatas;

  proposal.startTime = event.params.startTime;
  proposal.endTime = event.params.endTime;

  proposal.forVotes = BI_0;
  proposal.againstVotes = BI_0;

  proposal.canceled = false;
  proposal.executed = false;

  proposal.description = event.params.description;

  proposal.save();
}

export function handleUpdatedProposalCanceled(event: ProposalCanceled): void {
  const proposal = Proposal.load(event.params.id.toString())!;
  proposal.canceled = true;
  proposal.save();
}

export function handleUpdatedProposalExecuted(event: ProposalExecuted): void {
  const proposal = Proposal.load(event.params.id.toString())!;
  proposal.executed = true;
  proposal.save();
}

export function handleVoteCast(event: VoteCast): void {
  const proposal = Proposal.load(event.params.proposalId.toString())!;
  if (event.params.support) {
    proposal.forVotes = proposal.forVotes.plus(event.params.votes);
  } else {
    proposal.againstVotes = proposal.againstVotes.plus(event.params.votes);
  }
  proposal.save();
}

export function handleProposalQueued(event: ProposalQueued): void {
  const proposal = Proposal.load(event.params.id.toString())!;
  proposal.eta = event.params.eta;
  proposal.save();
}
