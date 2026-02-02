// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentFundEscrow
 * @notice Crowdfunding escrow for AI agent projects
 * @dev Milestone-based fund release with refunds on failure
 */
contract AgentFundEscrow {
    
    // ============ Structs ============
    
    struct Project {
        address creator;
        string name;
        string description;
        uint256 fundingGoal;
        uint256 deadline;
        uint256 totalFunded;
        uint256 milestonesCompleted;
        uint256 totalMilestones;
        bool cancelled;
        bool fullyFunded;
    }
    
    struct Milestone {
        string description;
        uint256 fundAmount;  // Amount released when completed
        bool completed;
    }
    
    struct Backer {
        uint256 amount;
        bool refunded;
    }
    
    // ============ State ============
    
    address public owner;
    address public treasury;
    uint256 public platformFeeBps = 500; // 5% default
    uint256 public projectCount;
    
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Milestone[]) public milestones;
    mapping(uint256 => mapping(address => Backer)) public backers;
    mapping(uint256 => address[]) public backerList;
    
    // ============ Events ============
    
    event ProjectCreated(uint256 indexed projectId, address indexed creator, string name, uint256 fundingGoal);
    event ProjectFunded(uint256 indexed projectId, address indexed backer, uint256 amount);
    event MilestoneCompleted(uint256 indexed projectId, uint256 milestoneIndex);
    event FundsReleased(uint256 indexed projectId, address indexed creator, uint256 amount);
    event ProjectCancelled(uint256 indexed projectId);
    event RefundClaimed(uint256 indexed projectId, address indexed backer, uint256 amount);
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyCreator(uint256 projectId) {
        require(msg.sender == projects[projectId].creator, "Not creator");
        _;
    }
    
    modifier projectExists(uint256 projectId) {
        require(projectId < projectCount, "Project doesn't exist");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
    }
    
    // ============ Create Project ============
    
    function createProject(
        string calldata name,
        string calldata description,
        uint256 fundingGoal,
        uint256 durationDays,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts
    ) external returns (uint256 projectId) {
        require(fundingGoal > 0, "Goal must be > 0");
        require(durationDays > 0 && durationDays <= 90, "Duration 1-90 days");
        require(milestoneDescriptions.length == milestoneAmounts.length, "Milestone mismatch");
        require(milestoneDescriptions.length > 0, "Need at least 1 milestone");
        
        // Verify milestone amounts sum to funding goal
        uint256 totalMilestoneAmount;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            totalMilestoneAmount += milestoneAmounts[i];
        }
        require(totalMilestoneAmount == fundingGoal, "Milestones must sum to goal");
        
        projectId = projectCount++;
        
        projects[projectId] = Project({
            creator: msg.sender,
            name: name,
            description: description,
            fundingGoal: fundingGoal,
            deadline: block.timestamp + (durationDays * 1 days),
            totalFunded: 0,
            milestonesCompleted: 0,
            totalMilestones: milestoneDescriptions.length,
            cancelled: false,
            fullyFunded: false
        });
        
        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            milestones[projectId].push(Milestone({
                description: milestoneDescriptions[i],
                fundAmount: milestoneAmounts[i],
                completed: false
            }));
        }
        
        emit ProjectCreated(projectId, msg.sender, name, fundingGoal);
    }
    
    // ============ Fund Project ============
    
    function fundProject(uint256 projectId) external payable projectExists(projectId) {
        Project storage project = projects[projectId];
        
        require(!project.cancelled, "Project cancelled");
        require(block.timestamp < project.deadline, "Deadline passed");
        require(msg.value > 0, "Must send ETH");
        
        // Track backer
        if (backers[projectId][msg.sender].amount == 0) {
            backerList[projectId].push(msg.sender);
        }
        backers[projectId][msg.sender].amount += msg.value;
        project.totalFunded += msg.value;
        
        // Check if fully funded
        if (project.totalFunded >= project.fundingGoal) {
            project.fullyFunded = true;
        }
        
        emit ProjectFunded(projectId, msg.sender, msg.value);
    }
    
    // ============ Complete Milestone ============
    
    function completeMilestone(uint256 projectId, uint256 milestoneIndex) 
        external 
        onlyCreator(projectId) 
        projectExists(projectId) 
    {
        Project storage project = projects[projectId];
        require(project.fullyFunded, "Not fully funded");
        require(!project.cancelled, "Project cancelled");
        require(milestoneIndex < project.totalMilestones, "Invalid milestone");
        
        Milestone storage milestone = milestones[projectId][milestoneIndex];
        require(!milestone.completed, "Already completed");
        
        // Must complete milestones in order
        if (milestoneIndex > 0) {
            require(milestones[projectId][milestoneIndex - 1].completed, "Complete previous first");
        }
        
        milestone.completed = true;
        project.milestonesCompleted++;
        
        // Calculate amount to release (minus platform fee)
        uint256 releaseAmount = milestone.fundAmount;
        uint256 fee = (releaseAmount * platformFeeBps) / 10000;
        uint256 creatorAmount = releaseAmount - fee;
        
        // Transfer to creator and treasury
        (bool success1, ) = project.creator.call{value: creatorAmount}("");
        require(success1, "Creator transfer failed");
        
        if (fee > 0) {
            (bool success2, ) = treasury.call{value: fee}("");
            require(success2, "Fee transfer failed");
        }
        
        emit MilestoneCompleted(projectId, milestoneIndex);
        emit FundsReleased(projectId, project.creator, creatorAmount);
    }
    
    // ============ Cancel Project ============
    
    function cancelProject(uint256 projectId) 
        external 
        onlyCreator(projectId) 
        projectExists(projectId) 
    {
        Project storage project = projects[projectId];
        require(!project.cancelled, "Already cancelled");
        require(project.milestonesCompleted == 0, "Milestones started");
        
        project.cancelled = true;
        emit ProjectCancelled(projectId);
    }
    
    // ============ Claim Refund ============
    
    function claimRefund(uint256 projectId) external projectExists(projectId) {
        Project storage project = projects[projectId];
        Backer storage backer = backers[projectId][msg.sender];
        
        require(backer.amount > 0, "Not a backer");
        require(!backer.refunded, "Already refunded");
        
        // Can refund if: cancelled OR (deadline passed AND not fully funded)
        bool canRefund = project.cancelled || 
            (block.timestamp >= project.deadline && !project.fullyFunded);
        require(canRefund, "Cannot refund");
        
        uint256 refundAmount = backer.amount;
        backer.refunded = true;
        
        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund failed");
        
        emit RefundClaimed(projectId, msg.sender, refundAmount);
    }
    
    // ============ View Functions ============
    
    function getProject(uint256 projectId) external view returns (Project memory) {
        return projects[projectId];
    }
    
    function getMilestones(uint256 projectId) external view returns (Milestone[] memory) {
        return milestones[projectId];
    }
    
    function getBackerAmount(uint256 projectId, address backer) external view returns (uint256) {
        return backers[projectId][backer].amount;
    }
    
    function getBackerCount(uint256 projectId) external view returns (uint256) {
        return backerList[projectId].length;
    }
    
    // ============ Admin ============
    
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
    
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Max 10%");
        platformFeeBps = _feeBps;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
