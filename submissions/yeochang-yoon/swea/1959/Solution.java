import java.util.*;
import java.io.FileInputStream;

class Solution
{
	public static void main(String args[]) throws Exception
	{
		
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
		
		for(int test_case = 1; test_case <= T; test_case++)
		{
			int n = sc.nextInt();
            int m = sc.nextInt();
            
            int[] A = new int[n];
            int[] B = new int[m];
            
            for (int i = 0; i < n; i++)
            {
            	A[i] = sc.nextInt();
            }
            for (int i = 0; i < m; i++)
            {
            	B[i] = sc.nextInt();
            }
            
            int max = Integer.MIN_VALUE;
            if(n > m)
            {
            	for (int i = 0; i <= n-m; i++)
                {
                    int sum = 0;
                	for (int j = 0; j < m; j++)
                    {
                    	sum += A[j+i] * B[j];
                    }
                    if(sum > max)
                    {
                    	max = sum;
                    }
                }
            } else 
            {
            	for (int i = 0; i <= m-n; i++)
                {
                    int sum = 0;
                	for (int j = 0; j < n; j++)
                    {
                    	sum += A[j] * B[j+i];
                    }
                    if(sum > max)
                    {
                    	max = sum;
                    }
                }
            }
            
            System.out.println("#" + test_case + " " + max);
		}
	}
}