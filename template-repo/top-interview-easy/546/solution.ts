export function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();

  for (let index = 0; index < nums.length; index += 1) {
    const complement = target - nums[index];
    const match = seen.get(complement);
    if (match !== undefined) {
      return [match, index];
    }
    seen.set(nums[index], index);
  }

  return [];
}
