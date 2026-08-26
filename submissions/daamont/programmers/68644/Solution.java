import java.util.TreeSet;

class Solution {
    public int[] solution(int[] numbers) {
        TreeSet<Integer> hap = new TreeSet<>();
        
        for(int i = 0; i < numbers.length; i++){
            for(int j = 1 + i; j < numbers.length; j++){
                hap.add(numbers[i] + numbers[j]);
            }
        }
        
        int[] answer = new int[hap.size()];
        int index = 0;
        for(int a : hap){
            answer[index++] = a;
        }
        
        return answer;
    }
}