import java.util.TreeSet;
import java.util.Set;

class Solution {
    public int[] solution(int[] numbers) {
        Set<Integer> set = new TreeSet<>(); // 자동으로 중복 제거 + 오름차순 정렬

        for (int i = 0; i < numbers.length; i++) {
            for (int j = i + 1; j < numbers.length; j++) {
                set.add(numbers[i] + numbers[j]);
            }
        }

        // int[]로 변환
        return set.stream()
                  .mapToInt(Integer::intValue)
                  .toArray();
    }
}
