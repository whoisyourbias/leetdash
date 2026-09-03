class Solution {
    public int solution(int[] num_list) {
        int answer = 0;

        int a1 = 0 , a2 = 1; 

        for(int i = 0; i < num_list.length; i++) {
            a1 += num_list[i];
            a2 *= num_list[i];
        }

        a1 = a1 * a1;
        if (a1 > a2)
            answer = 1;
        else
            answer = 0;
    
    return answer;
    }
}