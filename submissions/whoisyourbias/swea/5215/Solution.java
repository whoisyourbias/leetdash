import java.util.Scanner;
import java.io.FileInputStream;

/*
   사용하는 클래스명이 Solution 이어야 하므로, 가급적 Solution.java 를 사용할 것을 권장합니다.
   이러한 상황에서도 동일하게 java Solution 명령으로 프로그램을 수행해볼 수 있습니다.
 */
class Solution
{
    static class Ingre {
    	int favor;
        int cal;
        
        Ingre(int favor, int cal) {
        	this.favor = favor;
            this.cal = cal;
        }
    }
    
    static int N;
    static int L;
    static int cal_sum;
    static int favor_sum;
    static int favor_max;
    
    public static void main(String args[]) throws Exception
	{
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
        
		for(int test_case = 1; test_case <= T; test_case++)
		{
            N =sc.nextInt();
            L = sc.nextInt();
            
            favor_sum = 0;
            cal_sum = 0;
            favor_max = Integer.MIN_VALUE;
            
            Ingre[] igrs = new Ingre[N];
            
            for (int i = 0; i < N; i++) {
                igrs[i] = new Ingre(sc.nextInt(), sc.nextInt());
            }
            
            
            subset(0, igrs); 
            
            System.out.printf("#%d %d\n", test_case, favor_max);
		}
	}
    
    private static void subset(int depth, Ingre[] igrs) {
        if (cal_sum > L) {
        	return;
        } else {
        	favor_max = Math.max(favor_sum, favor_max);
        }
        if (depth == N) {
        	return;
        }
        cal_sum += igrs[depth].cal;
        favor_sum += igrs[depth].favor;
        subset(depth + 1,igrs);
        cal_sum -= igrs[depth].cal;
        favor_sum -= igrs[depth].favor;
        subset(depth + 1,igrs);
    }
}