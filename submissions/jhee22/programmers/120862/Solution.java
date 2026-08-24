import java.util.*; 
class Solution {
    public int solution(int[] numbers) {
        // 양수, 음수 곱의 경우를 산정해야함 : 제일 큰 수, 제일 작은 수를 비교하면 됨 아하! 
        // Arrays.sort() 는 void 를 반환, Arrays.copyOf() 는 배열
        Arrays.sort(numbers); 
        int idx = numbers.length; 
        int v1 = numbers[idx-1] * numbers[idx-2]; 
        int v2 = numbers[0] * numbers[1]; 
        
        return Math.max(v1, v2);
    }
}